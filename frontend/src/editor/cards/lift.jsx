// Lift — the truck (cards_plan.md §3). Relocation only: drag a rectangle
// over the piece, its pixels lift free and follow the hand, a click sets
// them down. Nothing new enters the piece; the vacancy stays white. The
// machinery is the lift session (editor/liftSession.js) — this file is only
// the card's voice: hooks, the Esc accent, and the panel.

import { UI } from '../../copy/uiText.js'
import { createLiftSession } from '../liftSession.js'

// Esc returns a carried piece to its place (hotkeys.md §5.4). With nothing
// in hand the key passes along to the global back-out.
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
  // A piece still in hand settles where it hangs; the holes and set-downs
  // stay on the canvas for the universal bake.
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
