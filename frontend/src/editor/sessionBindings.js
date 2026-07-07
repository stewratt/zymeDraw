// The shared keyboard grammars (hotkeys.md §5.2–5.3), extracted from
// Editor.jsx so Foundry speaks the identical dialect — the brush grammar is
// "identical everywhere a brush exists" by decision, and that now includes
// the sibling app. Pure binding builders: they return keymap.js binding
// lists and know nothing about which app is asking.

import { BRUSH_SIZE_MAX, BRUSH_SIZE_MIN } from './brushCore.js'

const clampBrushSize = (v) => Math.min(BRUSH_SIZE_MAX, Math.max(BRUSH_SIZE_MIN, v))

// The brush grammar (§5.2). read/write route to whichever state owns the
// brush — the standing mask brush or the current card's controls — so the
// panel always reflects the keys, same rule as shift+drag sizing. `conceal`
// is the op's code name; on screen it's Erase, and E is its key.
export function brushBindings(read, write, { canArrange, hasMode, hasHardness }) {
  const step = (e) => (e.shiftKey ? 10 : 5)
  const b = [
    { code: 'BracketLeft', run: (e) => write({ size: clampBrushSize(read().size - step(e)) }) },
    { code: 'BracketRight', run: (e) => write({ size: clampBrushSize(read().size + step(e)) }) }
  ]
  if (canArrange) b.push({ key: 'w', run: () => write({ mode: 'arrange' }) })
  if (hasMode) {
    b.push(
      { key: 'e', run: () => write({ mode: 'conceal' }) },
      { key: 'r', shift: false, run: () => write({ mode: 'restore' }) }, // Shift+R stays Restart
      { key: 's', run: () => write({ mode: 'soften' }) },
      {
        // The correction loop: swap Erase ↔ Restore. From any other mode
        // X does nothing — E and R already jump there directly.
        key: 'x',
        run: () => {
          const mode = read().mode
          if (mode === 'conceal') write({ mode: 'restore' })
          else if (mode === 'restore') write({ mode: 'conceal' })
        }
      }
    )
  }
  if (hasHardness) {
    b.push({ key: 'h', run: () => write({ hardness: read().hardness === 'soft' ? 'hard' : 'soft' }) })
  }
  return b
}

// Keyboard free-transform (§5.3): the active object, else the topmost
// interactive one (Deeper's frame, Rack's vessel). Respects the object's
// own lock flags (Etch's frame is position-only by construction) and fires
// the events a mouse gesture would, so per-card transform listeners stay
// in sync.
function transformArrangeTarget(getCanvas, motion, apply) {
  const canvas = getCanvas()
  if (!canvas) return
  let obj = canvas.getActiveObject()
  if (!obj) {
    const objects = canvas.getObjects()
    for (let i = objects.length - 1; i >= 0 && !obj; i--) {
      if (objects[i].selectable && objects[i].evented) obj = objects[i]
    }
  }
  if (!obj || !apply(obj)) return
  obj.setCoords()
  obj.fire(motion)
  canvas.fire(`object:${motion}`, { target: obj })
  canvas.fire('object:modified', { target: obj })
  canvas.requestRenderAll()
}

export function arrangeBindings(getCanvas) {
  const nudge = (dx, dy) => (e) =>
    transformArrangeTarget(getCanvas, 'moving', (obj) => {
      if (obj.lockMovementX && obj.lockMovementY) return false
      const step = e.shiftKey ? 10 : 1
      if (!obj.lockMovementX) obj.left += dx * step
      if (!obj.lockMovementY) obj.top += dy * step
      return true
    })
  const rotate = (dir) => (e) =>
    transformArrangeTarget(getCanvas, 'rotating', (obj) => {
      if (obj.lockRotation) return false
      obj.angle = (obj.angle + dir * (e.shiftKey ? 15 : 1)) % 360
      return true
    })
  const scale = (dir) => (e) =>
    transformArrangeTarget(getCanvas, 'scaling', (obj) => {
      if (obj.lockScalingX || obj.lockScalingY) return false
      const f = 1 + dir * (e.shiftKey ? 0.1 : 0.02)
      obj.scaleX *= f
      obj.scaleY *= f
      return true
    })
  return [
    { key: 'ArrowLeft', run: nudge(-1, 0) },
    { key: 'ArrowRight', run: nudge(1, 0) },
    { key: 'ArrowUp', run: nudge(0, -1) },
    { key: 'ArrowDown', run: nudge(0, 1) },
    { code: 'Comma', run: rotate(-1) },
    { code: 'Period', run: rotate(1) },
    { code: 'Minus', run: scale(-1) },
    { code: 'Equal', run: scale(1) }
  ]
}
