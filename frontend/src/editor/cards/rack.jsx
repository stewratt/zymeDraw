// Rack — the piece is racked to a new vessel: the whole canvas becomes one
// movable object for a round — drag, scale, rotate with the familiar
// handles, flip horizontal/vertical from the panel. Whatever hangs off the
// edge is gone at End; whatever the frame exposes is white. (Absorbs v1's
// Flip Canvas, with judgment added.)
//
// Implementation: the master leaves the background and becomes a regular
// free-transform FabricImage at 1/3 scale; the bake re-renders it through
// whatever transform you chose.

import * as fabric from 'fabric'
import { showMaster } from '../masterRaster.js'

export function beginRack(ctx) {
  const { canvas, master } = ctx
  canvas.backgroundImage = null
  const img = new fabric.FabricImage(master, {
    originX: 'center',
    originY: 'center',
    left: ctx.canvasWidth / 2,
    top: ctx.canvasHeight / 2,
    scaleX: ctx.canvasWidth / master.width,
    scaleY: ctx.canvasHeight / master.height
  })
  canvas.add(img)
  canvas.setActiveObject(img)
  canvas.requestRenderAll()
  return { img, master }
}

export function updateRack(ctx) {
  if (!ctx.session) return
  ctx.session.img.set({ flipX: !!ctx.controls.flipX, flipY: !!ctx.controls.flipY })
  ctx.canvas.requestRenderAll()
}

export function cleanupRack(ctx) {
  if (!ctx.session) return
  ctx.canvas.remove(ctx.session.img)
  showMaster(ctx.canvas, ctx.session.master)
}

export function RackTools({ controls, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        The piece is racked to a new vessel: drag, scale, rotate. What leaves
        the frame is gone; what the frame exposes stays white.
      </p>
      <div className="mode-toggle small">
        <button
          type="button"
          className={controls.flipX ? 'active' : ''}
          onClick={() => onControlChange('flipX', !controls.flipX)}
        >
          Flip H
        </button>
        <button
          type="button"
          className={controls.flipY ? 'active' : ''}
          onClick={() => onControlChange('flipY', !controls.flipY)}
        >
          Flip V
        </button>
      </div>
    </div>
  )
}
