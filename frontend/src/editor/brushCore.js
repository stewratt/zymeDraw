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
// One stroke engine, three built-in consumers (plus card-owned ones —
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
//   - STAMP mode (Reverberate): each stroke lays impressions of a source
//     bitmap at spacing intervals along the path, at master resolution —
//     the Kid Pix stamp-as-brush. Unlike reveal, impressions DO stack:
//     each one is a discrete deposit, and overlaps braid. Per-impression
//     jitter draws from a seed snapshot into the stroke record, so undo's
//     replay lays the exact rope the user saw.
//
// While a brush is active, a thin circle follows the pointer at the brush's
// on-screen size, so coverage is visible before and during a stroke.
//
// SHIFT+DRAG RESIZES THE BRUSH (any brush with a size slider): pressing with
// shift held starts a sizing drag instead of a stroke — the circle anchors
// where you pressed and drag right/left grows/shrinks it, 1 dragged pixel =
// 1 size pixel. The engine reports the new size out through `onSizeChange`
// so the consumer's slider state stays the single source of truth.
//
// Within-card undo/redo: a stroke is recorded points + settings, so undo =
// drop the last stroke and replay the rest into a fresh committed layer.
// History never survives an End — commitment stays absolute.

import * as fabric from 'fabric'
import { ARTBOARD_WIDTH, ARTBOARD_HEIGHT } from './CanvasStage.jsx'

// One range for every size slider AND the shift+drag clamp.
export const BRUSH_SIZE_MIN = 6
export const BRUSH_SIZE_MAX = 300

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

// A dab is an ellipse in mask space (radiusX/radiusY undo the target's
// scaleX/scaleY separately) so that the image's transform maps it back to
// a true circle on screen — a squashed image must not squash the brush.
//
// Softness (0–1) shapes the soft dab's falloff: the solid core shrinks from
// 25% of the radius toward 0 and the fade eases from linear toward cubic —
// at 0 the dab is exactly the pre-slider soft brush; at 1 it's all feather.
function drawDab(ctx, x, y, radiusX, radiusY, hardness, softness) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(radiusX, radiusY)
  if (hardness === 'hard') {
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'
  } else {
    const s = softness ?? 0
    const g = ctx.createRadialGradient(0, 0, 0.25 * (1 - s), 0, 0, 1)
    const ease = 1 + 2 * s
    for (let i = 0; i <= 6; i++) {
      const t = i / 6
      g.addColorStop(t, `rgba(0, 0, 0, ${Math.pow(1 - t, ease).toFixed(4)})`)
    }
    ctx.fillStyle = g
  }
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Stamp dabs from `from` to `to`, spaced at ~35% of the radius so strokes
// read as continuous lines rather than beads (the tighter axis sets the
// spacing so anisotropic dabs still overlap).
function drawSegment(ctx, from, to, radiusX, radiusY, hardness, softness) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const step = Math.max(1, Math.min(radiusX, radiusY) * 0.35)
  const count = Math.max(1, Math.ceil(dist / step))
  for (let i = 1; i <= count; i++) {
    const t = i / count
    drawDab(ctx, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radiusX, radiusY, hardness, softness)
  }
}

// Render a whole recorded stroke into a mask canvas (undo/redo replay; live
// drawing stamps dabs incrementally instead).
function renderStroke(mask, stroke) {
  const ctx = mask.getContext('2d')
  ctx.clearRect(0, 0, mask.width, mask.height)
  for (let i = 0; i < stroke.points.length; i++) {
    const from = stroke.points[Math.max(0, i - 1)]
    drawSegment(ctx, from, stroke.points[i], stroke.radiusX, stroke.radiusY, stroke.hardness, stroke.softness)
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
  let frozen = false // sizing drag: the circle stays anchored where it began

  // Brush size lives in scene units; getZoom() covers any zoomed viewport
  // and the CSS scale converts to on-screen pixels.
  function diameter(size) {
    const rect = canvas.wrapperEl.getBoundingClientRect()
    return Math.max(4, size * canvas.getZoom() * (rect.width / canvas.getWidth()))
  }

  function move(e) {
    if (!enabled || frozen) return
    const rect = canvas.wrapperEl.getBoundingClientRect()
    const d = diameter(getControls().size)
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
      frozen = false
      if (!next) hide()
    },
    setFrozen(next) {
      frozen = next
    },
    // Live diameter during a sizing drag — takes the size explicitly
    // because the consumer's React state is a frame behind the pointer.
    preview(size) {
      const d = diameter(size)
      el.style.width = `${d}px`
      el.style.height = `${d}px`
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
// A stroke record: { points, radius, hardness, softness, settings }. `settings` is
// snapshotSettings(controls) — the consumer's per-stroke snapshot (mask:
// strength + op; reveal: influence + effect params).
// `resolveTarget(scenePoint, brushRadius)` picks which object a stroke
// sticks to (the whole stroke stays on it). It may say "none yet": a stroke
// begun on empty canvas keeps recording and attaches to the first target it
// resolves to mid-drag, so strokes can start outside every image.
export function createStrokeEngine(canvas, { states, resolveTarget, getControls, snapshotSettings, onHistoryChange, onSizeChange }) {
  const undoStack = [] // { img, stroke } in global stroke order
  let redoStack = []
  let active = false
  let drawing = null // { img, stroke, maskCtx, lastPoint } while the pointer is down
  let sizing = null // { onMove, onUp } window listeners while shift+drag resizes
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
    // Brush size is felt in display pixels; convert to source pixels per
    // axis so the dab matches what's under the cursor regardless of the
    // target's scale — including non-uniform squashes.
    const radiusX = controls.size / 2 / (Math.abs(img.scaleX) || 1)
    const radiusY = controls.size / 2 / (Math.abs(img.scaleY) || 1)
    const points = scenePoints.map((sp) => toLocal(img, sp))
    const stroke = {
      points,
      radiusX,
      radiusY,
      hardness: controls.hardness,
      softness: controls.softness ?? 0.5,
      settings: snapshotSettings(controls)
    }
    const s = states.get(img)
    clearLayer(s.strokeMask)
    const maskCtx = s.strokeMask.getContext('2d')
    for (let i = 0; i < points.length; i++) {
      drawSegment(maskCtx, points[Math.max(0, i - 1)], points[i], radiusX, radiusY, stroke.hardness, stroke.softness)
    }
    drawing = { img, stroke, maskCtx, lastPoint: points[points.length - 1] }
    s.recomposite(stroke)
  }

  // Shift+drag sizing. Listeners live on window so the drag keeps working
  // past the canvas edge; the circle anchors where the drag began.
  function beginSizing(e) {
    const startX = e.clientX
    const startSize = getControls().size
    const onMove = (ev) => {
      const size = Math.round(
        Math.min(BRUSH_SIZE_MAX, Math.max(BRUSH_SIZE_MIN, startSize + (ev.clientX - startX)))
      )
      onSizeChange(size)
      cursor.preview(size)
    }
    const onUp = () => endSizing()
    sizing = { onMove, onUp }
    cursor.setFrozen(true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function endSizing() {
    if (!sizing) return
    window.removeEventListener('pointermove', sizing.onMove)
    window.removeEventListener('pointerup', sizing.onUp)
    sizing = null
    cursor.setFrozen(false)
  }

  function onMouseDown(opt) {
    if (!active || drawing || sizing) return
    if (canvas.__navPanArmed) return // Space held: a pan is in progress, don't paint
    if (opt.e?.shiftKey && onSizeChange) {
      beginSizing(opt.e)
      return
    }
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
    drawSegment(
      drawing.maskCtx,
      drawing.lastPoint,
      point,
      drawing.stroke.radiusX,
      drawing.stroke.radiusY,
      drawing.stroke.hardness,
      drawing.stroke.softness
    )
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
        endSizing()
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
      endSizing()
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
    // the stroke. The blur radius rides the brush (half the dab radius —
    // the two axes' mean, since ctx.filter blur is isotropic).
    // ctx.filter blur needs Safari 18+ — same caveat as the effect brushes;
    // older Safari just gets a no-op.
    const b = blurScratch.getContext('2d')
    b.save()
    b.clearRect(0, 0, blurScratch.width, blurScratch.height)
    b.filter = `blur(${Math.max(1, (stroke.radiusX + stroke.radiusY) / 2 * 0.5)}px)`
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

export function createMaskSession(canvas, images, { getControls, onHistoryChange, onSizeChange }) {
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
    onHistoryChange,
    onSizeChange
  })
}

// ---------- reveal mode (effect cards) ----------

// Everything a control panel shows that isn't the brush itself is an effect
// param, snapshotted per stroke. (softness must live here: if it leaked into
// params, sliding it would miss the effect cache and re-roll Dust's grain.)
const BRUSH_KEYS = new Set(['size', 'hardness', 'softness', 'intensity'])

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
export function createRevealSession(canvas, { applyEffect, master, getControls, onHistoryChange, onSizeChange }) {
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
    // Master-res composite → artboard footprint (scene units), NOT the buffer:
    // in fill mode the buffer is the workspace, which would stretch it (#53).
    scaleX: ARTBOARD_WIDTH / composite.width,
    scaleY: ARTBOARD_HEIGHT / composite.height,
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
    onHistoryChange,
    onSizeChange
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

// ---------- stamp mode (impressions along the path) ----------

// Jitter must survive undo: rebuild replays a stroke record, and a wobble
// re-rolled at replay would repaint a DIFFERENT rope than the one the user
// chose to keep. So each stroke snapshots a seed, and every impression takes
// its wobble from this deterministic stream, in landing order.
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Size wobble at full jitter: ±35% of the stamp size; rotation: ±30°.
const JITTER_SIZE = 0.35
const JITTER_ANGLE = Math.PI / 6

// Walk a stroke's polyline and place one impression per arc-length interval
// — position, size, angle, all in master pixels. Pure function of the stroke
// record, so live preview, the release bake, and undo's replay all lay the
// identical impressions. The first impression lands at the press point: a
// plain click stamps exactly once.
function impressionsFor(stroke) {
  const { spacing, jitter, seed } = stroke.settings
  const rand = mulberry32(seed)
  const wobble = () => (rand() * 2 - 1) * jitter
  const size = stroke.radiusX * 2
  const interval = Math.max(4, size * spacing)
  const out = []
  let need = 0 // arc length at which the next impression lands
  let walked = 0
  for (let i = 0; i < stroke.points.length; i++) {
    const from = stroke.points[Math.max(0, i - 1)]
    const to = stroke.points[i]
    const seg = Math.hypot(to.x - from.x, to.y - from.y)
    while (walked + seg >= need) {
      const t = seg === 0 ? 0 : (need - walked) / seg
      out.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        size: size * (1 + wobble() * JITTER_SIZE),
        angle: wobble() * JITTER_ANGLE
      })
      need += interval
    }
    walked += seg
  }
  return out
}

// Draw impressions[from..] — the source scaled so its longer side matches
// the impression size, centered and rotated on the landing point. Opacity is
// per impression: overlaps within one stroke stack, and the braid darkens
// where copies cross — a deposit, not a reveal.
function drawImpressions(ctx, stampEl, impressions, from, opacity) {
  const w = stampEl.naturalWidth || stampEl.width
  const h = stampEl.naturalHeight || stampEl.height
  for (let i = from; i < impressions.length; i++) {
    const imp = impressions[i]
    const fit = imp.size / Math.max(w, h)
    ctx.save()
    ctx.globalAlpha = clampAlpha(opacity)
    ctx.translate(imp.x, imp.y)
    ctx.rotate(imp.angle)
    ctx.drawImage(stampEl, (-w * fit) / 2, (-h * fit) / 2, w * fit, h * fit)
    ctx.restore()
  }
}

// `stampEl` is the source bitmap (the cutout — an image or canvas element);
// `master` supplies the working resolution. Same overlay shape as the
// reveal session: a full-canvas Fabric image whose pixels live at master
// size, left in place at End for the universal bake.
export function createStampSession(canvas, { stampEl, master, getControls, onHistoryChange, onSizeChange }) {
  const accumulated = makeLayer(master.width, master.height) // locked strokes
  const strokeMask = makeLayer(master.width, master.height) // engine scratch; impressions never read it
  const liveLayer = makeLayer(master.width, master.height) // the in-progress stroke
  const composite = makeLayer(master.width, master.height)

  const overlay = new fabric.FabricImage(composite, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    // Master-res composite → artboard footprint (scene units), NOT the buffer:
    // in fill mode the buffer is the workspace, which would stretch it (#53).
    scaleX: ARTBOARD_WIDTH / composite.width,
    scaleY: ARTBOARD_HEIGHT / composite.height,
    selectable: false,
    evented: false
  })
  canvas.add(overlay)

  let live = null // { stroke, drawn } — impressions already on liveLayer

  function redraw() {
    const ctx = composite.getContext('2d')
    ctx.clearRect(0, 0, composite.width, composite.height)
    ctx.drawImage(accumulated, 0, 0)
    ctx.drawImage(liveLayer, 0, 0)
    overlay.dirty = true
    canvas.requestRenderAll()
  }

  const state = {
    strokeMask,
    strokes: [],
    bakeStroke(stroke) {
      // Deterministic re-lay of the whole stroke — identical to what the
      // live preview showed, impression for impression.
      drawImpressions(
        accumulated.getContext('2d'),
        stampEl,
        impressionsFor(stroke),
        0,
        stroke.settings.opacity
      )
    },
    clearCommitted() {
      clearLayer(accumulated)
    },
    recomposite(liveStroke) {
      if (!liveStroke) {
        live = null
        clearLayer(liveLayer)
      } else {
        // Incremental: only the impressions the path just crossed are new —
        // the seeded stream makes the full list stable, so drawing the tail
        // is safe.
        if (live?.stroke !== liveStroke) {
          live = { stroke: liveStroke, drawn: 0 }
          clearLayer(liveLayer)
        }
        const imps = impressionsFor(liveStroke)
        drawImpressions(
          liveLayer.getContext('2d'),
          stampEl,
          imps,
          live.drawn,
          liveStroke.settings.opacity
        )
        live.drawn = imps.length
      }
      redraw()
    }
  }

  const engine = createStrokeEngine(canvas, {
    states: new Map([[overlay, state]]),
    // The overlay covers the whole canvas; every stroke belongs to it.
    resolveTarget: () => overlay,
    getControls,
    snapshotSettings: (c) => ({
      opacity: c.opacity ?? 1,
      spacing: c.spacing ?? 0.6,
      jitter: c.jitter ?? 0,
      seed: Math.floor(Math.random() * 4294967296)
    }),
    onHistoryChange,
    onSizeChange
  })
  engine.setActive(true)

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
