// Cure — the piece cures in its own bath (Wash × soft light): a soft-light
// self-overlay deepens the mids and richens tone without dominating — the
// classic darkroom move, distinct from Steep (a dye) and Turn (a shift).
// Influence is how far the cure has gone; it carries the mandatory
// whole-canvas influence control (CLAUDE.md §1).
//
// Implementation: the master itself, laid over the canvas in `soft-light`
// blend at influence opacity. No redraw needed when influence moves — the
// overlay's source never changes, only its opacity.

import * as fabric from 'fabric'

export function beginCure(ctx) {
  const overlay = new fabric.FabricImage(ctx.master, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: ctx.canvasWidth / ctx.master.width,
    scaleY: ctx.canvasHeight / ctx.master.height,
    opacity: ctx.controls.intensity,
    globalCompositeOperation: 'soft-light',
    selectable: false,
    evented: false
  })
  ctx.canvas.add(overlay)
  ctx.canvas.requestRenderAll()
  return { overlay }
}

export function updateCure(ctx) {
  if (!ctx.session) return
  ctx.session.overlay.set({ opacity: ctx.controls.intensity })
  ctx.canvas.requestRenderAll()
}

export function cleanupCure(ctx) {
  if (!ctx.session) return
  ctx.canvas.remove(ctx.session.overlay)
  ctx.canvas.requestRenderAll()
}

export function CureTools({ controls, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        The piece cures in its own bath — mids deepen, tone richens. Influence
        is how far the cure has gone.
      </p>
      <label className="ctrl">
        <span className="ctrl-label">Influence</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(controls.intensity * 100)}
          onChange={(e) => onControlChange('intensity', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.intensity * 100)}%</span>
      </label>
    </div>
  )
}
