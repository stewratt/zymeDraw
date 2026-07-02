// The universal brush core.
//
// The rule that makes everything else work: STROKES NEVER TOUCH SOURCE
// PIXELS. Every brush target has an offscreen grayscale MASK canvas at the
// target's native resolution; strokes paint dabs into the mask, and a
// COMPOSITE canvas derived from (source, mask) is what Fabric actually
// renders. Because composites live at native resolution, the 3× bake picks
// up brushwork at full detail for free.
//
// One stroke engine, two consumers:
//   - ERASE mode  (placement sessions): mask is punched OUT of a placed
//     image (destination-out). Painting hides pixels.
//   - REVEAL mode (effect cards): an effected copy of the master sits over
//     the canvas, fully masked out; painting reveals it (destination-in).
//     An intensity control scales the whole reveal via globalAlpha.
//
// Within-card undo/redo falls out of the same design: a stroke is recorded
// points, so undo = drop the last stroke and replay the rest into a fresh
// mask. History never survives an End — commitment stays absolute.

import * as fabric from 'fabric'

// Convert a scene-space point to target-local source pixels. The transform
// matrix handles position, scale, rotation and flips in one step.
function toLocal(img, scenePoint) {
  const inv = fabric.util.invertTransform(img.calcTransformMatrix())
  const p = fabric.util.transformPoint(scenePoint, inv)
  return { x: p.x + img.width / 2, y: p.y + img.height / 2 }
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

// The shared stroke engine. `states` maps each brushable Fabric object to
// { mask, strokes, recomposite }; `resolveTarget(scenePoint)` picks which
// object a stroke sticks to (the whole stroke stays on it).
function createStrokeEngine(canvas, { states, resolveTarget, getControls, onHistoryChange }) {
  const undoStack = [] // { img, stroke } in global stroke order
  let redoStack = []
  let active = false
  let current = null // { img, stroke, maskCtx, lastPoint } while the pointer is down
  const savedCanvasProps = {
    skipTargetFind: canvas.skipTargetFind,
    defaultCursor: canvas.defaultCursor
  }

  function notify() {
    onHistoryChange?.(undoStack.length > 0, redoStack.length > 0)
  }

  function rebuildMask(img) {
    const s = states.get(img)
    const ctx = s.mask.getContext('2d')
    ctx.clearRect(0, 0, s.mask.width, s.mask.height)
    for (const stroke of s.strokes) {
      for (let i = 0; i < stroke.points.length; i++) {
        const from = stroke.points[Math.max(0, i - 1)]
        drawSegment(ctx, from, stroke.points[i], stroke.radius, stroke.hardness)
      }
    }
    s.recomposite()
  }

  function onMouseDown(opt) {
    if (!active) return
    const scenePoint = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    const img = resolveTarget(scenePoint)
    if (!img) return
    const { size, hardness } = getControls()
    // Brush size is felt in display pixels; convert to source pixels so the
    // dab matches what's under the cursor regardless of the target's scale.
    const radius = size / 2 / ((Math.abs(img.scaleX) + Math.abs(img.scaleY)) / 2)
    const point = toLocal(img, scenePoint)
    const stroke = { points: [point], radius, hardness }
    current = { img, stroke, maskCtx: states.get(img).mask.getContext('2d'), lastPoint: point }
    drawDab(current.maskCtx, point.x, point.y, radius, hardness)
    states.get(img).recomposite()
  }

  function onMouseMove(opt) {
    if (!active || !current) return
    const scenePoint = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    const point = toLocal(current.img, scenePoint)
    drawSegment(current.maskCtx, current.lastPoint, point, current.stroke.radius, current.stroke.hardness)
    current.stroke.points.push(point)
    current.lastPoint = point
    states.get(current.img).recomposite()
  }

  function onMouseUp() {
    if (!current) return
    states.get(current.img).strokes.push(current.stroke)
    undoStack.push({ img: current.img, stroke: current.stroke })
    redoStack = []
    current = null
    notify()
  }

  canvas.on('mouse:down', onMouseDown)
  canvas.on('mouse:move', onMouseMove)
  canvas.on('mouse:up', onMouseUp)

  return {
    setActive(next) {
      active = next
      if (next) {
        canvas.discardActiveObject()
        canvas.skipTargetFind = true
        canvas.defaultCursor = 'crosshair'
      } else {
        current = null
        canvas.skipTargetFind = savedCanvasProps.skipTargetFind
        canvas.defaultCursor = savedCanvasProps.defaultCursor
      }
      canvas.requestRenderAll()
    },

    undo() {
      const entry = undoStack.pop()
      if (!entry) return
      states.get(entry.img).strokes.pop()
      redoStack.push(entry)
      rebuildMask(entry.img)
      notify()
    },

    redo() {
      const entry = redoStack.pop()
      if (!entry) return
      states.get(entry.img).strokes.push(entry.stroke)
      undoStack.push(entry)
      rebuildMask(entry.img)
      notify()
    },

    dispose() {
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
      canvas.skipTargetFind = savedCanvasProps.skipTargetFind
      canvas.defaultCursor = savedCanvasProps.defaultCursor
      current = null
    }
  }
}

// ---------- erase mode ----------

export function createEraseSession(canvas, images, { getControls, onHistoryChange }) {
  // Per-image erase state, set up front: the Fabric object's element is
  // swapped for a same-size composite canvas so display and bake both
  // render the erased result from full-resolution pixels.
  const states = new Map()
  for (const img of images) {
    const source = img.getElement()
    const mask = document.createElement('canvas')
    mask.width = img.width
    mask.height = img.height
    const composite = document.createElement('canvas')
    composite.width = img.width
    composite.height = img.height
    composite.getContext('2d').drawImage(source, 0, 0)
    img.setElement(composite)
    states.set(img, {
      mask,
      strokes: [],
      recomposite() {
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
    // Topmost placed image under the pointer takes the whole stroke.
    resolveTarget(scenePoint) {
      const objects = canvas.getObjects()
      for (let i = objects.length - 1; i >= 0; i--) {
        if (states.has(objects[i]) && objects[i].containsPoint(scenePoint)) return objects[i]
      }
      return null
    },
    getControls,
    onHistoryChange
  })
}

// ---------- reveal mode (effect cards) ----------

// `effected` is a full-strength effected copy of the master, same size.
// It goes on the canvas as a non-interactive overlay, fully masked out;
// painting reveals it. Intensity scales the reveal via globalAlpha, so the
// slider is instant — the effect is never recomputed.
export function createRevealSession(canvas, effected, { getControls, getIntensity, onHistoryChange }) {
  const mask = document.createElement('canvas')
  mask.width = effected.width
  mask.height = effected.height
  const composite = document.createElement('canvas')
  composite.width = effected.width
  composite.height = effected.height

  const overlay = new fabric.FabricImage(composite, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: canvas.getWidth() / effected.width,
    scaleY: canvas.getHeight() / effected.height,
    selectable: false,
    evented: false
  })
  canvas.add(overlay)

  function recomposite() {
    const ctx = composite.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, composite.width, composite.height)
    ctx.globalAlpha = Math.max(0, Math.min(1, getIntensity()))
    ctx.drawImage(effected, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, 0, 0)
    ctx.restore()
    overlay.dirty = true
    canvas.requestRenderAll()
  }

  const states = new Map([[overlay, { mask, strokes: [], recomposite }]])
  const engine = createStrokeEngine(canvas, {
    states,
    // The overlay covers the whole canvas; every stroke belongs to it.
    resolveTarget: () => overlay,
    getControls,
    onHistoryChange
  })
  engine.setActive(true)

  return {
    ...engine,
    overlay,
    // Re-blend after an intensity change; the effect itself is untouched.
    refresh: recomposite,
    // Restart abandons the card: take the overlay with us.
    removeOverlay() {
      canvas.remove(overlay)
      canvas.requestRenderAll()
    }
  }
}
