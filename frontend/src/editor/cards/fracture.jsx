// Fracture — the fracture family's exemplar (cards_plan.md §4): the whole
// piece breaks into voronoi chunks that each slide as a rigid block, an
// all-over displacement you then compose by carving it back. Structure is
// Transfer's (full-canvas overlay + the standing mask brush + an influence
// slider) with the sidecar style model swapped for a local displacement
// field (editor/fractureField.js). The judgment is in the taking away: the
// mask brush cuts the untouched piece back through wherever it should win.
//
// seed / scale re-generate the field into the overlay's source canvas in
// place, then refresh() the mask session so the painted mask survives
// (the sanctioned redraw-in-place path — Ghost and Rails do the same).
// opacity is live. End bakes whatever remains.

import * as fabric from 'fabric'
import { createMaskSession } from '../brushCore.js'
import { computeFracture } from '../fractureField.js'
import { MaskBrushControls } from './maskControls.jsx'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

const SEED_MAX = 99
const SCALE_MIN = 20 // display-px chunk size — fine gravel
const SCALE_MAX = 600 // display-px chunk size — a handful of big plates
const REGEN_DELAY = 120 // ms — debounce a seed/scale drag to the value it lands on

// Fill the overlay's source canvas with the field for these settings.
function paintField(el, master, controls) {
  el.getContext('2d').putImageData(computeFracture(master, { seed: controls.seed, scale: controls.scale }), 0, 0)
}

export function beginFracture(ctx) {
  const el = document.createElement('canvas')
  el.width = ctx.master.width
  el.height = ctx.master.height
  paintField(el, ctx.master, ctx.controls)

  const img = new fabric.FabricImage(el, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: ctx.canvasWidth / el.width,
    scaleY: ctx.canvasHeight / el.height,
    selectable: false,
    evented: false,
    opacity: ctx.controls.opacity
  })
  ctx.canvas.add(img)
  ctx.canvas.requestRenderAll()

  const controlsRef = { current: ctx.controls }
  const session = createMaskSession(ctx.canvas, [img], {
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo }),
    onSizeChange: (size) => ctx.setControl('size', size)
  })
  session.setActive(true) // the erase brush stays in hand for the whole card

  ctx.report({ undo: session.undo, redo: session.redo, canUndo: false, canRedo: false })
  return { img, el, session, controlsRef, master: ctx.master, last: { seed: ctx.controls.seed, scale: ctx.controls.scale }, timer: null }
}

export function updateFracture(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.img.set({ opacity: ctx.controls.opacity }) // influence is live
  ctx.canvas.requestRenderAll()

  // Regenerating the field is the heavy step; debounce it to the value the
  // drag lands on. Opacity above already applied — only seed/scale re-paint.
  if (ctx.controls.seed === s.last.seed && ctx.controls.scale === s.last.scale) return
  if (s.timer) clearTimeout(s.timer)
  s.timer = setTimeout(() => {
    s.timer = null
    s.last = { seed: s.controlsRef.current.seed, scale: s.controlsRef.current.scale }
    paintField(s.el, s.master, s.controlsRef.current)
    s.session.refresh() // re-composite the new field under the untouched mask
  }, REGEN_DELAY)
}

export function commitFracture(ctx) {
  const s = ctx.session
  if (!s) return
  if (s.timer) clearTimeout(s.timer)
  s.session.dispose() // drop the brush; the overlay stays for the universal bake
}

export function cleanupFracture(ctx) {
  const s = ctx.session
  if (!s) return
  if (s.timer) clearTimeout(s.timer)
  s.session.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

export function FractureTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">{CARD_TEXT.fracture.description}</p>
      <label className="ctrl" title="Re-roll the distribution of chunks">
        <span className="ctrl-label">Seed</span>
        <input type="range" min="0" max={SEED_MAX} value={controls.seed} onChange={(e) => onControlChange('seed', Number(e.target.value))} />
        <span className="ctrl-value mono">{controls.seed}</span>
      </label>
      <label className="ctrl" title="How big the chunks are — bigger chunks slide farther">
        <span className="ctrl-label">Scale</span>
        <input type="range" min={SCALE_MIN} max={SCALE_MAX} value={controls.scale} onChange={(e) => onControlChange('scale', Number(e.target.value))} />
        <span className="ctrl-value mono">{controls.scale}px</span>
      </label>
      <label className="ctrl" title="How strongly the fractured layer sits over the piece">
        <span className="ctrl-label">Influence</span>
        <input
          type="range"
          min="5"
          max="100"
          value={Math.round(controls.opacity * 100)}
          onChange={(e) => onControlChange('opacity', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.opacity * 100)}%</span>
      </label>
      <MaskBrushControls controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
