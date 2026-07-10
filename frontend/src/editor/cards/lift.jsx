// Lift — the clone stamp (cards_plan.md §3). Copy only: drag a rectangle
// over the piece, a copy of its pixels lifts free and follows the hand, a
// click stamps it down. The source stays untouched — a second impression is
// added, nothing is removed. The machinery is the clone session
// (editor/liftSession.js) — this file is only the card's voice: hooks, the
// Esc accent, and the panel.

import { UI } from '../../copy/uiText.js'
import { createLiftSession } from '../liftSession.js'

// Esc discards a copy in hand, or clears a marquee mid-drag (hotkeys.md
// §5.4). With nothing in progress the key passes along to the global
// back-out.
export const liftHotkeys = [
  {
    key: 'Escape',
    run: ({ session }) => (session?.cancelCarry() ? undefined : false)
  }
]

export function beginLift(ctx) {
  const session = createLiftSession(ctx.canvas, ctx.master, {
    onStateChange: (view) => ctx.report(view)
  })
  ctx.report({ undo: session.undo, redo: session.redo })
  return session
}

export function commitLift(ctx) {
  // A copy still in hand settles where it hangs; the stamped copies stay on
  // the canvas for the universal bake.
  ctx.session?.settle()
  ctx.session?.dispose({ keepObjects: true })
}

export function cleanupLift(ctx) {
  ctx.session?.dispose({ keepObjects: false })
}

export function LiftTools({ info, ready }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  const T = UI.cardHints.lift
  return (
    <div className="card-tools">
      <p className="hint">{info.stage === 'carry' ? T.carryHint : T.takeHint}</p>
      <div className="undo-row">
        <button type="button" className="secondary" title="Cmd/Ctrl+Z" disabled={!info.canUndo} onClick={() => info.undo?.()}>
          Undo
        </button>
        <button type="button" className="secondary" title="Cmd/Ctrl+Shift+Z" disabled={!info.canRedo} onClick={() => info.redo?.()}>
          Redo
        </button>
      </div>
    </div>
  )
}
