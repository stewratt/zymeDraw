// Steep — the whole piece soaks in a dye bath: pick the dye, the blend,
// and how long it steeps (the influence slider is steeping time). One of
// the permitted whole-canvas modifiers (color adjustments with an
// influence control — CLAUDE.md §1).
//
// Implementation: a full-canvas Rect whose globalCompositeOperation blends
// it over everything beneath (including the master background) at render
// time — on screen and in the bake alike. No pixels touched until End.

import * as fabric from 'fabric'

const BLENDS = ['multiply', 'screen', 'overlay', 'color']

export function beginSteep(ctx) {
  const rect = new fabric.Rect({
    left: 0,
    top: 0,
    width: ctx.canvasWidth,
    height: ctx.canvasHeight,
    fill: ctx.controls.color,
    opacity: ctx.controls.intensity,
    globalCompositeOperation: ctx.controls.blend,
    selectable: false,
    evented: false
  })
  ctx.canvas.add(rect)
  ctx.canvas.requestRenderAll()
  return { rect }
}

export function updateSteep(ctx) {
  if (!ctx.session) return
  ctx.session.rect.set({
    fill: ctx.controls.color,
    opacity: ctx.controls.intensity,
    globalCompositeOperation: ctx.controls.blend
  })
  ctx.canvas.requestRenderAll()
}

export function cleanupSteep(ctx) {
  if (!ctx.session) return
  ctx.canvas.remove(ctx.session.rect)
  ctx.canvas.requestRenderAll()
}

export function SteepTools({ controls, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">The piece steeps in a dye bath. Influence is steeping time.</p>
      <label className="ctrl">
        <span className="ctrl-label">Dye</span>
        <input
          type="color"
          value={controls.color}
          onChange={(e) => onControlChange('color', e.target.value)}
        />
        <span className="ctrl-value mono">{controls.color}</span>
      </label>
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
      <div className="mode-toggle small">
        {BLENDS.map((b) => (
          <button
            key={b}
            type="button"
            className={controls.blend === b ? 'active' : ''}
            onClick={() => onControlChange('blend', b)}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  )
}
