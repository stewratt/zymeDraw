// Smieer — the classic smudge brush, dragged across the whole piece. Nothing
// enters and nothing is coloured: existing pixels only move and blend along
// the stroke, the way a finger pulls wet ink. The counterpart to Lift, which
// cards_plan.md §3 describes as "a smudge brush with no smudge" — this is the
// smudge that line pointed at.
//
// The card is thin by design; the whole cost of the design is the new
// primitive underneath it (editor/smieerSession.js — the pickup buffer). Its
// four hooks are the effect brushes' hooks with the reveal session swapped
// for the smieer session: begin opens it, End drops the brush and leaves the
// overlay for the universal bake, Restart takes the overlay with it.

import { createSmieerSession } from '../smieerSession.js'
import { BrushSliders } from './maskControls.jsx'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

export function beginSmieer(ctx) {
  const controlsRef = { current: ctx.controls }
  const session = createSmieerSession(ctx.canvas, {
    master: ctx.master,
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo }),
    onSizeChange: (size) => ctx.setControl('size', size)
  })
  ctx.report({ undo: session.undo, redo: session.redo, canUndo: false, canRedo: false })
  return { session, controlsRef }
}

export function updateSmieer(ctx) {
  // Settings are per stroke: the next one reads the ref when it begins.
  if (ctx.session) ctx.session.controlsRef.current = ctx.controls
}

export function commitSmieer(ctx) {
  ctx.session?.session.dispose()
}

export function cleanupSmieer(ctx) {
  if (!ctx.session) return
  ctx.session.session.dispose()
  ctx.session.session.removeOverlay()
}

export function SmieerTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">{CARD_TEXT.smieer.description}</p>
      <BrushSliders controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
