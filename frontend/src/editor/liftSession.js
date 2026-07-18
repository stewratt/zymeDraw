// The clone session — the third gesture engine, sibling to brushCore's
// stroke engines (cards_plan.md §3).
//
// The rule: a gesture COPIES a rectangle of the piece and stamps it down
// elsewhere. A press-drag marquee chooses the source rectangle; on release
// a copy of its master pixels lifts free as a floating image that follows
// the cursor, and a click stamps it down. The source stays exactly as it
// was — nothing is removed, nothing white is left behind; the copy simply
// adds a second impression of what was already there. A round is a series
// of these clone gestures.
//
// Master discipline: the marquee snaps to whole master pixels, the copied
// element is a master-resolution canvas displayed at 1/MASTER_SCALE, and
// the stamp-down snaps back to the master grid — so the universal bake
// lands every clone 1:1, no resampling. A copy carried past an edge is
// cropped by the bake (it renders only the visible canvas); that is by
// design — the source is untouched, so nothing unique is ever lost.
//
// Copied pixels are read from a composite of the master plus the round's
// earlier clones, in order — so cloning a region you just stamped into
// takes what you see.
//
// Undo/redo is per gesture, reported through the card's ctx (the sanctioned
// within-card channel): undo removes the last stamped copy, redo restores
// it. Both are held while a copy is in hand — a carry reads from a
// composite that an undo would falsify.
//
// The fracture family (cards_plan.md §4) is expected to inherit this
// machinery — keep the card-specific voice in lift.jsx, not here.

import * as fabric from 'fabric'
import { MASTER_SCALE } from './masterRaster.js'

const MIN_LIFT = 6 // display px per side — smaller is a click, not a take

// Marquee visuals: white-under-black dashed pair, Etch's frame trick, so
// the rectangle reads on any ground.
function makeMarqueeRects() {
  const dims = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    originX: 'left',
    originY: 'top',
    fill: 'rgba(0, 0, 0, 0)',
    selectable: false,
    evented: false,
    strokeUniform: true,
    objectCaching: false
  }
  return [
    new fabric.Rect({ ...dims, stroke: '#ffffff', strokeWidth: 2.5 }),
    new fabric.Rect({ ...dims, stroke: '#111111', strokeWidth: 1, strokeDashArray: [3, 3] })
  ]
}

export function createLiftSession(canvas, master, { onStateChange }) {
  const S = MASTER_SCALE
  const gestures = [] // { dest, pixels, img } — stamped copies, in order
  let redoStack = []
  let marquee = null // { rects, start } while the source-rectangle is dragging
  let carry = null // { img, pixels, offsetX, offsetY } in hand

  const saved = {
    selection: canvas.selection,
    skipTargetFind: canvas.skipTargetFind,
    defaultCursor: canvas.defaultCursor
  }
  canvas.selection = false
  canvas.skipTargetFind = true
  canvas.defaultCursor = 'crosshair'
  canvas.discardActiveObject()

  function notify() {
    onStateChange?.({
      stage: carry ? 'carry' : 'take',
      canUndo: !carry && gestures.length > 0,
      canRedo: !carry && redoStack.length > 0
    })
  }

  // The piece as it stands mid-round: the master plus every stamped copy
  // replayed in order.
  function compositeCurrent() {
    const c = document.createElement('canvas')
    c.width = master.width
    c.height = master.height
    const ctx = c.getContext('2d')
    ctx.drawImage(master, 0, 0)
    for (const g of gestures) ctx.drawImage(g.pixels, g.dest.x, g.dest.y)
    return c
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v))
  }

  function marqueeBounds(p) {
    const x1 = clamp(marquee.start.x, 0, canvas.getWidth())
    const y1 = clamp(marquee.start.y, 0, canvas.getHeight())
    const x2 = clamp(p.x, 0, canvas.getWidth())
    const y2 = clamp(p.y, 0, canvas.getHeight())
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    }
  }

  function removeMarquee() {
    if (!marquee) return
    canvas.remove(...marquee.rects)
    marquee = null
    canvas.requestRenderAll()
  }

  // Release of the marquee: a copy of the region's pixels lifts free and
  // follows the cursor from where it lies — no jump; the first movement is
  // the drag. The source pixels stay untouched behind it.
  function beginCarry(bounds, scenePoint) {
    const src = {
      x: Math.round(bounds.left * S),
      y: Math.round(bounds.top * S),
      w: Math.max(1, Math.round(bounds.width * S)),
      h: Math.max(1, Math.round(bounds.height * S))
    }
    const pixels = document.createElement('canvas')
    pixels.width = src.w
    pixels.height = src.h
    pixels.getContext('2d').drawImage(compositeCurrent(), src.x, src.y, src.w, src.h, 0, 0, src.w, src.h)

    const img = new fabric.FabricImage(pixels, {
      left: src.x / S,
      top: src.y / S,
      originX: 'left',
      originY: 'top',
      scaleX: 1 / S,
      scaleY: 1 / S,
      selectable: false,
      evented: false
    })
    canvas.add(img)
    // Offset the copy against the clamped release point, so releasing the
    // marquee past an edge doesn't snap the copy away from the cursor.
    const rx = clamp(scenePoint.x, 0, canvas.getWidth())
    const ry = clamp(scenePoint.y, 0, canvas.getHeight())
    carry = {
      img,
      pixels,
      offsetX: img.left - rx,
      offsetY: img.top - ry
    }
    canvas.defaultCursor = 'grabbing'
    canvas.requestRenderAll()
    notify()
  }

  // Click stamps it down: snap to the master grid so the bake is 1:1 (a copy
  // hanging past an edge crops there), lock the gesture into the record, and
  // the hand is free for the next take.
  function setDown() {
    const { img, pixels } = carry
    const dest = { x: Math.round(img.left * S), y: Math.round(img.top * S) }
    img.set({ left: dest.x / S, top: dest.y / S })
    img.setCoords()
    gestures.push({ dest, pixels, img })
    redoStack = []
    carry = null
    canvas.defaultCursor = 'crosshair'
    canvas.requestRenderAll()
    notify()
  }

  function onMouseDown(opt) {
    if (canvas.__navPanArmed) return // Space held: a pan is in progress, don't take/drop
    if (carry) {
      setDown()
      return
    }
    const p = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    marquee = { rects: makeMarqueeRects(), start: p }
    for (const r of marquee.rects) {
      r.set({ left: p.x, top: p.y, width: 0, height: 0 })
      canvas.add(r)
    }
  }

  function onMouseMove(opt) {
    const p = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    if (carry) {
      carry.img.set({ left: p.x + carry.offsetX, top: p.y + carry.offsetY })
      canvas.requestRenderAll()
      return
    }
    if (!marquee) return
    const b = marqueeBounds(p)
    for (const r of marquee.rects) r.set(b)
    canvas.requestRenderAll()
  }

  function onMouseUp(opt) {
    if (!marquee) return
    const p = opt.scenePoint ?? canvas.getScenePoint(opt.e)
    const b = marqueeBounds(p)
    removeMarquee()
    if (b.width < MIN_LIFT || b.height < MIN_LIFT) return // a click, not a take
    beginCarry(b, p)
  }

  canvas.on('mouse:down', onMouseDown)
  canvas.on('mouse:move', onMouseMove)
  canvas.on('mouse:up', onMouseUp)
  notify()

  return {
    // Esc backs out the take in progress: a copy in hand is discarded, or a
    // marquee mid-drag is cleared. Returns false when there is nothing to
    // back out, so the key can pass along to the global back-out.
    cancelCarry() {
      if (carry) {
        canvas.remove(carry.img)
        carry = null
        canvas.defaultCursor = 'crosshair'
        canvas.requestRenderAll()
        notify()
        return true
      }
      if (marquee) {
        removeMarquee()
        return true
      }
      return false
    },

    // End mid-carry: the copy settles where it hangs.
    settle() {
      if (carry) setDown()
      removeMarquee()
    },

    undo() {
      if (carry || gestures.length === 0) return
      const g = gestures.pop()
      canvas.remove(g.img)
      redoStack.push(g)
      canvas.requestRenderAll()
      notify()
    },

    redo() {
      if (carry || redoStack.length === 0) return
      const g = redoStack.pop()
      canvas.add(g.img)
      gestures.push(g)
      canvas.requestRenderAll()
      notify()
    },

    // keepObjects: true on commit (the stamped copies stay for the universal
    // bake), false on cleanup (Restart leaves nothing behind).
    dispose({ keepObjects }) {
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
      removeMarquee()
      if (!keepObjects) {
        if (carry) canvas.remove(carry.img)
        for (const g of gestures) canvas.remove(g.img)
        for (const g of redoStack) canvas.remove(g.img)
      }
      carry = null
      canvas.selection = saved.selection
      canvas.skipTargetFind = saved.skipTargetFind
      canvas.defaultCursor = saved.defaultCursor
      canvas.requestRenderAll()
    }
  }
}
