// The universal brush core — erase mode.
//
// The rule that makes everything else work: STROKES NEVER TOUCH SOURCE
// PIXELS. Each placed image gets an offscreen grayscale MASK canvas at the
// image's native resolution. Brush strokes paint dabs into the mask; a
// COMPOSITE canvas (source image minus mask, via destination-out) is what
// the Fabric object actually renders. Because the composite lives at source
// resolution, the 3× bake picks up erasures at full detail for free.
//
// Within-card undo/redo falls out of the same design: a stroke is just
// recorded points, so undo = drop the last stroke and replay the rest into
// a fresh mask. History never survives an End — commitment stays absolute.
//
// Phase 4 adds the second consumer (effect mode: paint to *reveal* an
// effected copy); the dab/stroke/undo machinery here is shared.

import * as fabric from 'fabric'

// Convert a scene-space point to image-local source pixels. The transform
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

export function createEraseSession(canvas, images, { getControls, onHistoryChange }) {
  // Per-image erase state, set up front: the Fabric object's element is
  // swapped for a same-size composite canvas so display and bake both
  // render the erased result from full-resolution pixels.
  const states = new Map()
  for (const img of images) {
    const w = img.width
    const h = img.height
    const source = img.getElement()
    const mask = document.createElement('canvas')
    mask.width = w
    mask.height = h
    const composite = document.createElement('canvas')
    composite.width = w
    composite.height = h
    composite.getContext('2d').drawImage(source, 0, 0)
    img.setElement(composite)
    states.set(img, { source, mask, composite, strokes: [] })
  }

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

  function recomposite(img) {
    const s = states.get(img)
    const ctx = s.composite.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, s.composite.width, s.composite.height)
    ctx.drawImage(s.source, 0, 0)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(s.mask, 0, 0)
    ctx.restore()
    img.dirty = true // invalidate Fabric's object cache
    canvas.requestRenderAll()
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
    recomposite(img)
  }

  // Topmost placed image under the pointer; the whole stroke sticks to it.
  function findTarget(scenePoint) {
    const objects = canvas.getObjects()
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i]
      if (states.has(obj) && obj.containsPoint(scenePoint)) return obj
    }
    return null
  }

  function onMouseDown(opt) {
    if (!active) return
    const scenePoint = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    const img = findTarget(scenePoint)
    if (!img) return
    const { size, hardness } = getControls()
    // Brush size is felt in display pixels; convert to source pixels so the
    // dab matches what's under the cursor regardless of the image's scale.
    const radius = size / 2 / ((Math.abs(img.scaleX) + Math.abs(img.scaleY)) / 2)
    const point = toLocal(img, scenePoint)
    const stroke = { points: [point], radius, hardness }
    current = { img, stroke, maskCtx: states.get(img).mask.getContext('2d'), lastPoint: point }
    drawDab(current.maskCtx, point.x, point.y, radius, hardness)
    recomposite(img)
  }

  function onMouseMove(opt) {
    if (!active || !current) return
    const scenePoint = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    const point = toLocal(current.img, scenePoint)
    drawSegment(current.maskCtx, current.lastPoint, point, current.stroke.radius, current.stroke.hardness)
    current.stroke.points.push(point)
    current.lastPoint = point
    recomposite(current.img)
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
      const s = states.get(entry.img)
      s.strokes.pop()
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
