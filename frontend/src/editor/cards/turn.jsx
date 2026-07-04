// Turn — the whole batch turns: a whole-canvas hue/saturation/brightness
// shift with an influence slider. The shifted copy of the master sits over
// the canvas at `intensity` opacity, so 100% is the full turn and 40% is a
// lean. The other permitted whole-canvas modifier (CLAUDE.md §1).
//
// Reuses Bruise's filter draw; no mask, no brush — the influence slider IS
// the judgment here.

import * as fabric from 'fabric'
import { HsvSliders, applyHsvShift } from './bruise.jsx'

export function beginTurn(ctx) {
  const effected = document.createElement('canvas')
  effected.width = ctx.master.width
  effected.height = ctx.master.height
  applyHsvShift(effected, ctx.master, ctx.controls)
  const overlay = new fabric.FabricImage(effected, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: ctx.canvasWidth / effected.width,
    scaleY: ctx.canvasHeight / effected.height,
    opacity: ctx.controls.intensity,
    selectable: false,
    evented: false
  })
  ctx.canvas.add(overlay)
  ctx.canvas.requestRenderAll()
  return { effected, overlay, master: ctx.master }
}

export function updateTurn(ctx) {
  const s = ctx.session
  if (!s) return
  applyHsvShift(s.effected, s.master, ctx.controls)
  s.overlay.set({ opacity: ctx.controls.intensity })
  s.overlay.dirty = true
  ctx.canvas.requestRenderAll()
}

export function cleanupTurn(ctx) {
  if (!ctx.session) return
  ctx.canvas.remove(ctx.session.overlay)
  ctx.canvas.requestRenderAll()
}

export function TurnTools({ controls, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">The whole batch turns. Influence decides how far.</p>
      <HsvSliders controls={controls} onControlChange={onControlChange} />
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
