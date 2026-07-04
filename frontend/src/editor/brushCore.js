// The universal brush core.
//
// The rule that makes everything else work: STROKES NEVER TOUCH SOURCE
// PIXELS. Every brush target has offscreen canvases at the target's native
// resolution; strokes paint dabs into masks, and a COMPOSITE canvas derived
// from them is what Fabric actually renders. Because composites live at
// native resolution, the 3× bake picks up brushwork at full detail for free.
//
// PER-STROKE SETTINGS: the sliders describe the brush in your hand, not the
// picture. Each stroke snapshots its settings the moment it begins and locks
// them at release — sliding a slider sets up the NEXT stroke, it never
// touches what's already painted. Layer up as many settings as you like in
// one pass.
//
// One stroke engine, two built-in consumers (plus card-owned ones —
// createStrokeEngine is exported for cards whose composite the built-ins
// can't express, e.g. Shattered Transfer's styled-window overlay):
//   - MASK mode  (placement sessions): the standing mask brush. Each stroke
//     is one of three ops on the image's mask — CONCEAL punches out of the
//     placed image at the stroke's strength, RESTORE paints concealed areas
//     back (the mask lives in image-native coordinates, so it travels with
//     the image through move/scale/rotate — reposition-then-correct works
//     by construction), SOFTEN feathers the mask locally by lerping it
//     toward a blurred copy of itself under the stroke. A stroke never
//     stacks with itself; crossing strokes accumulate.
//   - REVEAL mode (effect cards): each stroke stamps effected pixels — the
//     effect computed FROM THE MASTER at that stroke's own settings — into
//     an accumulation layer at that stroke's influence. Strokes are agnostic
//     of each other: blur over blur covers, it doesn't compound.
//
// While a brush is active, a thin circle follows the pointer at the brush's
// on-screen size, so coverage is visible before and during a stroke.
//
// Within-card undo/redo: a stroke is recorded points + settings, so undo =
// drop the last stroke and replay the rest into a fresh committed layer.
// History never survives an End — commitment stays absolute.

import * as fabric from 'fabric'

// Convert a scene-space point to target-local source pixels. The transform
// matrix handles position, scale, rotation and flips in one step.
function toLocal(img, scenePoint) {
  const inv = fabric.util.invertTransform(img.calcTransformMatrix())
  const p = fabric.util.transformPoint(scenePoint, inv)
  return { x: p.x + img.width / 2, y: p.y + img.height / 2 }
}

export function makeLayer(width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

export function clearLayer(layer) {
  layer.getContext('2d').clearRect(0, 0, layer.width, layer.height)
}

function drawDab(ctx, x, y, radius, hardness) {
  if (hardness === 'hard') {
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'
  } else {
    const g = ctx.createRadialGradient(x, y, radius * 0.25, x, y, radius)
    g.addColorStop(0, 'rgba(0, 0, 0, 1)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
  }
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

// Stamp dabs from `from` to `to`, spaced at ~35% of the radius so strokes
// read as continuous lines rather than beads.
function drawSegment(ctx, from, to, radius, hardness) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const step = Math.max(1, radius * 0.35)
  const count = Math.max(1, Math.ceil(dist / step))
  for (let i = 1; i <= count; i++) {
    const t = i / count
    drawDab(ctx, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius, hardness)
  }
}

// Render a whole recorded stroke into a mask canvas (undo/redo replay; live
// drawing stamps dabs incrementally instead).
function renderStroke(mask, stroke) {
  const ctx = mask.getContext('2d')
  ctx.clearRect(0, 0, mask.width, mask.height)
  for (let i = 0; i < stroke.points.length; i++) {
    const from = stroke.points[Math.max(0, i - 1)]
    drawSegment(ctx, from, stroke.points[i], stroke.radius, stroke.hardness)
  }
}

// The brush-size circle. It lives in Fabric's wrapper div and follows the
// pointer via DOM events (which keep firing mid-drag). The canvas buffer is
// CSS-scaled to fit the viewport, so the brush's logical size converts to
// on-screen pixels on every move.
function createBrushCursor(canvas, getControls) {
  const el = document.createElement('div')
  el.className = 'brush-cursor'
  canvas.wrapperEl.appendChild(el)
  let enabled = false

  function move(e) {
    if (!enabled) return
    const rect = canvas.wrapperEl.getBoundingClientRect()
    // getZoom() covers any zoomed viewport: brush size lives in scene
    // units, so zoomed-in views show a proportionally bigger circle.
    const d = Math.max(4, getControls().size * canvas.getZoom() * (rect.width / canvas.getWidth()))
    el.style.width = `${d}px`
    el.style.height = `${d}px`
    el.style.left = `${e.clientX - rect.left}px`
    el.style.top = `${e.clientY - rect.top}px`
    el.style.display = 'block'
  }
  function hide() {
    el.style.display = 'none'
  }

  canvas.wrapperEl.addEventListener('pointermove', move)
  canvas.wrapperEl.addEventListener('pointerleave', hide)

  return {
    setEnabled(next) {
      enabled = next
      if (!next) hide()
    },
    dispose() {
      canvas.wrapperEl.removeEventListener('pointermove', move)
      canvas.wrapperEl.removeEventListener('pointerleave', hide)
      el.remove()
    }
  }
}

// The shared stroke engine. `states` maps each brushable Fabric object to
// its consumer state:
//   strokeMask       : scratch canvas holding the ONE live stroke, full alpha
//   strokes          : this target's locked stroke records, in order
//   bakeStroke(s)    : stamp strokeMask into the committed layer using
//                      s.settings (exactly once per stroke, at release)
//   clearCommitted() : reset the committed layer (undo/redo replay)
//   recomposite(live): rebuild the visible composite; `live` is the stroke
//                      record still riding on strokeMask, or null
//
// A stroke record: { points, radius, hardness, settings }. `settings` is
// snapshotSettings(controls) — the consumer's per-stroke snapshot (mask:
// strength + op; reveal: influence + effect params).
// `resolveTarget(scenePoint, brushRadius)` picks which object a stroke
// sticks to (the whole stroke stays on it). It may say "none yet": a stroke
// begun on empty canvas keeps recording and attaches to the first target it
// resolves to mid-drag, so strokes can start outside every image.
export function createStrokeEngine(canvas, { states, resolveTarget, getControls, snapshotSettings, onHistoryChange }) {
  const undoStack = [] // { img, stroke } in global stroke order
  let redoStack = []
  let active = false
  let drawing = null // { img, stroke, maskCtx, lastPoint } while the pointer is down
  const cursor = createBrushCursor(canvas, getControls)
  const savedCanvasProps = {
    skipTargetFind: canvas.skipTargetFind,
    defaultCursor: canvas.defaultCursor
  }

  function notify() {
    onHistoryChange?.(undoStack.length > 0, redoStack.length > 0)
  }

  // Rebuild a target's committed layer by replaying its recorded strokes,
  // each at its own settings.
  function rebuild(img) {
    const s = states.get(img)
    s.clearCommitted()
    for (const stroke of s.strokes) {
      renderStroke(s.strokeMask, stroke)
      s.bakeStroke(stroke)
    }
    clearLayer(s.strokeMask)
    s.recomposite(null)
  }

  // Attach a stroke to `img`, replaying every scene point recorded so far —
  // a stroke may have travelled over empty canvas before reaching a target,
  // and the path segment that crosses the edge must still land.
  function beginStroke(img, scenePoints, controls) {
    // Brush size is felt in display pixels; convert to source pixels so the
    // dab matches what's under the cursor regardless of the target's scale.
    const radius = controls.size / 2 / ((Math.abs(img.scaleX) + Math.abs(img.scaleY)) / 2)
    const points = scenePoints.map((sp) => toLocal(img, sp))
    const stroke = {
      points,
      radius,
      hardness: controls.hardness,
      settings: snapshotSettings(controls)
    }
    const s = states.get(img)
    clearLayer(s.strokeMask)
    const maskCtx = s.strokeMask.getContext('2d')
    for (let i = 0; i < points.length; i++) {
      drawSegment(maskCtx, points[Math.max(0, i - 1)], points[i], radius, stroke.hardness)
    }
    drawing = { img, stroke, maskCtx, lastPoint: points[points.length - 1] }
    s.recomposite(stroke)
  }

  function onMouseDown(opt) {
    if (!active || drawing) return
    const scenePoint = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    const controls = getControls()
    const img = resolveTarget(scenePoint, controls.size / 2)
    if (img) {
      beginStroke(img, [scenePoint], controls)
    } else {
      // Pressed on empty canvas: keep recording the path and attach it to
      // the first target the brush circle touches mid-drag.
      drawing = { img: null, controls, scenePoints: [scenePoint] }
    }
  }

  function onMouseMove(opt) {
    if (!active || !drawing) return
    const scenePoint = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    if (!drawing.img) {
      drawing.scenePoints.push(scenePoint)
      const img = resolveTarget(scenePoint, drawing.controls.size / 2)
      if (img) beginStroke(img, drawing.scenePoints, drawing.controls)
      return
    }
    const point = toLocal(drawing.img, scenePoint)
    drawSegment(drawing.maskCtx, drawing.lastPoint, point, drawing.stroke.radius, drawing.stroke.hardness)
    drawing.stroke.points.push(point)
    drawing.lastPoint = point
    states.get(drawing.img).recomposite(drawing.stroke)
  }

  function onMouseUp() {
    if (!drawing) return
    if (!drawing.img) {
      // The stroke never reached a target — nothing to lock in.
      drawing = null
      return
    }
    const { img, stroke } = drawing
    const s = states.get(img)
    // The stroke locks at release: baked with the settings it was painted
    // with. Sliders only configure the next one.
    s.strokes.push(stroke)
    s.bakeStroke(stroke)
    clearLayer(s.strokeMask)
    s.recomposite(null)
    undoStack.push({ img, stroke })
    redoStack = []
    drawing = null
    notify()
  }

  canvas.on('mouse:down', onMouseDown)
  canvas.on('mouse:move', onMouseMove)
  canvas.on('mouse:up', onMouseUp)

  return {
    setActive(next) {
      if (next === active) return
      active = next
      cursor.setEnabled(next)
      if (next) {
        canvas.discardActiveObject()
        canvas.skipTargetFind = true
        canvas.defaultCursor = 'none' // the circle is the cursor
      } else {
        drawing = null
        canvas.skipTargetFind = savedCanvasProps.skipTargetFind
        canvas.defaultCursor = savedCanvasProps.defaultCursor
      }
      canvas.requestRenderAll()
    },

    // Recomposite every target. For consumers that redraw a source canvas
    // in place (Ghost's brightness/contrast, Rails' tint) — masks untouched.
    refresh() {
      for (const img of states.keys()) states.get(img).recomposite(null)
    },

    undo() {
      const entry = undoStack.pop()
      if (!entry) return
      redoStack.push(entry)
      states.get(entry.img).strokes.pop()
      rebuild(entry.img)
      notify()
    },

    redo() {
      const entry = redoStack.pop()
      if (!entry) return
      const s = states.get(entry.img)
      s.strokes.push(entry.stroke)
      undoStack.push(entry)
      renderStroke(s.strokeMask, entry.stroke)
      s.bakeStroke(entry.stroke)
      clearLayer(s.strokeMask)
      s.recomposite(null)
      notify()
    },

    dispose() {
      cursor.dispose()
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
      canvas.skipTargetFind = savedCanvasProps.skipTargetFind
      canvas.defaultCursor = savedCanvasProps.defaultCursor
      drawing = null
    }
  }
}

// ---------- mask mode (the standing brush) ----------

const MASK_OPS = new Set(['conceal', 'restore', 'soften'])

// A stroke's settings.op → its `mode` control, conceal by default ('arrange'
// never reaches a stroke — the engine is inactive then).
export function snapshotMaskSettings(controls) {
  return {
    strength: controls.strength ?? 1,
    op: MASK_OPS.has(controls.mode) ? controls.mode : 'conceal'
  }
}

// Apply one locked-or-live stroke's op to a mask canvas. Shared by the mask
// session below and by card-owned engines whose committed mask means
// "concealment" (Shattered Transfer's trim).
export function applyMaskOp(mask, strokeMask, blurScratch, stroke) {
  const { op, strength } = stroke.settings
  const ctx = mask.getContext('2d')
  if (op === 'soften') {
    // Feather = lerp the mask toward a blurred copy of itself, only under
    // the stroke. The blur radius rides the brush (half the dab radius).
    // ctx.filter blur needs Safari 18+ — same caveat as the effect brushes;
    // older Safari just gets a no-op.
    const b = blurScratch.getContext('2d')
    b.save()
    b.clearRect(0, 0, blurScratch.width, blurScratch.height)
    b.filter = `blur(${Math.max(1, stroke.radius * 0.5)}px)`
    b.drawImage(mask, 0, 0)
    b.filter = 'none'
    b.globalCompositeOperation = 'destination-in'
    b.drawImage(strokeMask, 0, 0)
    b.restore()
    ctx.save()
    ctx.globalAlpha = strength
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(strokeMask, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(blurScratch, 0, 0)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.globalAlpha = strength
  // Restore paints concealment OUT of the mask; conceal paints it in.
  if (op === 'restore') ctx.globalCompositeOperation = 'destination-out'
  ctx.drawImage(strokeMask, 0, 0)
  ctx.restore()
}

export function createMaskSession(canvas, images, { getControls, onHistoryChange }) {
  // Per-image mask state, set up front: the Fabric object's element is
  // swapped for a same-size composite canvas so display and bake both
  // render the masked result from full-resolution pixels. committedMask
  // holds graded alpha — how much past strokes concealed each pixel; the
  // live stroke rides separately at its own strength, previewed through
  // effMask so all three ops show their true result mid-stroke.
  const states = new Map()
  for (const img of images) {
    const source = img.getElement()
    const committedMask = makeLayer(img.width, img.height)
    const strokeMask = makeLayer(img.width, img.height)
    const effMask = makeLayer(img.width, img.height) // committed + live preview
    const blurScratch = makeLayer(img.width, img.height) // soften staging
    const composite = makeLayer(img.width, img.height)
    composite.getContext('2d').drawImage(source, 0, 0)
    img.setElement(composite)

    states.set(img, {
      strokeMask,
      strokes: [],
      bakeStroke(stroke) {
        applyMaskOp(committedMask, strokeMask, blurScratch, stroke)
      },
      clearCommitted() {
        clearLayer(committedMask)
      },
      recomposite(liveStroke) {
        let mask = committedMask
        if (liveStroke) {
          const ectx = effMask.getContext('2d')
          ectx.clearRect(0, 0, effMask.width, effMask.height)
          ectx.drawImage(committedMask, 0, 0)
          applyMaskOp(effMask, strokeMask, blurScratch, liveStroke)
          mask = effMask
        }
        const ctx = composite.getContext('2d')
        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.clearRect(0, 0, composite.width, composite.height)
        ctx.drawImage(source, 0, 0)
        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(mask, 0, 0)
        ctx.restore()
        img.dirty = true // invalidate Fabric's object cache
        canvas.requestRenderAll()
      }
    })
  }

  return createStrokeEngine(canvas, {
    states,
    // Topmost placed image the brush circle touches takes the whole stroke —
    // circle, not pointer point, so a big soft brush hovering just outside an
    // edge can graze it with only its falloff.
    resolveTarget(scenePoint, brushRadius) {
      const objects = canvas.getObjects()
      for (let i = objects.length - 1; i >= 0; i--) {
        const img = objects[i]
        if (!states.has(img)) continue
        const p = toLocal(img, scenePoint)
        const r = brushRadius / ((Math.abs(img.scaleX) + Math.abs(img.scaleY)) / 2)
        const dx = Math.max(-p.x, p.x - img.width, 0)
        const dy = Math.max(-p.y, p.y - img.height, 0)
        if (Math.hypot(dx, dy) <= r) return img
      }
      return null
    },
    getControls,
    snapshotSettings: snapshotMaskSettings,
    onHistoryChange
  })
}

// ---------- reveal mode (effect cards) ----------

// Everything a control panel shows that isn't the brush itself is an effect
// param, snapshotted per stroke.
const BRUSH_KEYS = new Set(['size', 'hardness', 'intensity'])

function effectParams(controls) {
  const params = {}
  for (const k of Object.keys(controls)) {
    if (!BRUSH_KEYS.has(k)) params[k] = controls[k]
  }
  return params
}

const clampAlpha = (v) => Math.max(0, Math.min(1, v))

// `applyEffect(effectedEl, master, params)` draws a full-strength effected
// copy of the master. The session calls it lazily per unique params combo
// and caches the copies, so a stroke's first dab and undo replay stay fast
// — and Noise's grain (params never change) doesn't re-roll.
export function createRevealSession(canvas, { applyEffect, master, getControls, onHistoryChange }) {
  const accumulated = makeLayer(master.width, master.height) // locked strokes
  const strokeMask = makeLayer(master.width, master.height)
  const scratch = makeLayer(master.width, master.height)
  const composite = makeLayer(master.width, master.height)

  const cache = new Map() // params key → effected copy, LRU
  const CACHE_LIMIT = 4
  function effectedFor(params) {
    const key = JSON.stringify(params)
    let el = cache.get(key)
    if (el) {
      cache.delete(key)
      cache.set(key, el)
      return el
    }
    el = makeLayer(master.width, master.height)
    applyEffect(el, master, params)
    cache.set(key, el)
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value)
    return el
  }

  // scratch = one stroke's effected pixels: the effect at its params,
  // clipped to its strokeMask.
  function maskEffected(params) {
    const ctx = scratch.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, scratch.width, scratch.height)
    ctx.drawImage(effectedFor(params), 0, 0)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(strokeMask, 0, 0)
    ctx.restore()
    return scratch
  }

  const overlay = new fabric.FabricImage(composite, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: canvas.getWidth() / composite.width,
    scaleY: canvas.getHeight() / composite.height,
    selectable: false,
    evented: false
  })
  canvas.add(overlay)

  const state = {
    strokeMask,
    strokes: [],
    bakeStroke(stroke) {
      const ctx = accumulated.getContext('2d')
      ctx.save()
      ctx.globalAlpha = clampAlpha(stroke.settings.intensity)
      ctx.drawImage(maskEffected(stroke.settings.params), 0, 0)
      ctx.restore()
    },
    clearCommitted() {
      clearLayer(accumulated)
    },
    recomposite(liveStroke) {
      const ctx = composite.getContext('2d')
      ctx.clearRect(0, 0, composite.width, composite.height)
      ctx.drawImage(accumulated, 0, 0)
      if (liveStroke) {
        ctx.save()
        ctx.globalAlpha = clampAlpha(liveStroke.settings.intensity)
        ctx.drawImage(maskEffected(liveStroke.settings.params), 0, 0)
        ctx.restore()
      }
      overlay.dirty = true
      canvas.requestRenderAll()
    }
  }

  const engine = createStrokeEngine(canvas, {
    states: new Map([[overlay, state]]),
    // The overlay covers the whole canvas; every stroke belongs to it.
    resolveTarget: () => overlay,
    getControls,
    snapshotSettings: (c) => ({ intensity: c.intensity, params: effectParams(c) }),
    onHistoryChange
  })
  engine.setActive(true)
  // Warm the cache at the default settings so the first stroke doesn't pay
  // the effect compute (Noise's pixel loop is the slow one) at mouse-down.
  effectedFor(effectParams(getControls()))

  return {
    ...engine,
    overlay,
    // Restart abandons the card: take the overlay with us.
    removeOverlay() {
      canvas.remove(overlay)
      canvas.requestRenderAll()
    }
  }
}
