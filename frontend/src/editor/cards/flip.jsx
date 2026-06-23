import * as fabric from 'fabric'

// Flip Canvas Horizontal — simple geometric midgame card.
//
// Mirrors the whole composition left-to-right while KEEPING layers separate:
// each committed object is mirrored individually, not flattened into one image.
//
// The mirror is applied as a live preview the instant the card is drawn, so the
// user sees exactly what they're committing. A horizontal flip is its own
// inverse, so `cleanup` just runs the same op again to restore the original.
//
// Per-object math: a true canvas mirror maps every point x -> W - x. For an
// object rotated by θ that resolves to three changes — negate the angle, toggle
// flipX, and mirror the object's center across the vertical midline. (The world
// mirror matrix diag(-1, 1) times Rotate(θ) equals Rotate(-θ) times a flipped
// x-scale.) Using getCenterPoint()/setPositionByOrigin keeps it correct no
// matter what originX/originY each layer happens to use.

export function flipAllHorizontal(canvas, width) {
  for (const obj of canvas.getObjects()) {
    if (!obj.deckId) continue
    const c = obj.getCenterPoint()
    obj.angle = -(obj.angle || 0)
    obj.flipX = !obj.flipX
    obj.setPositionByOrigin(new fabric.Point(width - c.x, c.y), 'center', 'center')
    obj.setCoords()
  }
  canvas.requestRenderAll()
}

export function beginFlip(ctx) {
  flipAllHorizontal(ctx.canvas, ctx.canvasWidth)
  // Stash width so cleanup can revert (the restart ctx doesn't pass dimensions).
  return { width: ctx.canvasWidth }
}

export function commitFlip(ctx) {
  // The preview flip is already on the canvas; nothing to bake. Just render.
  ctx.canvas.requestRenderAll()
}

export function cleanupFlip(ctx) {
  if (!ctx.session) return
  flipAllHorizontal(ctx.canvas, ctx.session.width)
}

export function FlipTools() {
  return (
    <div className="pencil-tools">
      <p className="hint">
        The whole canvas is mirrored left-to-right — layers stay separate. End
        commits the flip.
      </p>
    </div>
  )
}
