// Skim — the scry (v4 notes §5.2). Turn the top card of the deck over and
// make one choice: leave it (it's your next deal) or bury it (slipped back
// in somewhere random), never seeing what replaces it. Skim sees
// everything — once death is armed the top card can be the Coda, and
// keeping it is choosing your ending.
//
// Skim never touches the canvas: the reveal and the choice are deck
// actions; the round ends with a plain End (skipBake in the registry).
// The turn is click-only, deliberately — Enter deals, and a double-press
// must never turn the card before you've registered that Skim arrived.

import { useEffect } from 'react'
import Card from '../Card.jsx'

// The Ghost pattern: begin awaits the user so End stays disabled until
// the choice is made (or there is nothing to see). The overlay resolves
// it through info.done after dispatching the choice.
export async function beginSkim(ctx) {
  await new Promise((resolve) => ctx.report({ done: resolve }))
  return null
}

export function SkimOverlay({ info, deckView, onDeckAction, workUrl }) {
  const skim = deckView?.skim ?? null

  const choose = (type) => {
    onDeckAction({ type })
    info?.done?.()
  }

  // Dealt from an empty deck — nothing on top. End is the whole round;
  // release it.
  const nothingToSee = skim != null && !skim.card
  useEffect(() => {
    if (nothingToSee) info?.done?.()
  }, [nothingToSee, info])

  let stage
  if (!skim) {
    stage = (
      <>
        <p className="hint">The top of the deck, seen once. Turn it.</p>
        <button type="button" className="primary" onClick={() => onDeckAction({ type: 'SKIM' })}>
          Turn the top card
        </button>
      </>
    )
  } else if (!skim.card) {
    stage = <p className="hint">The deck is empty — there is nothing on top.</p>
  } else if (!skim.choice) {
    stage = (
      <>
        <Card id={skim.card.id} label={skim.card.label} kind={skim.card.kind} size="reveal" flip />
        <p className="hint">Leave it or bury it — you won&apos;t see what replaces it.</p>
        <div className="skim-choices">
          <button type="button" className="primary" onClick={() => choose('SKIM_KEEP')}>
            Leave it — the next deal
          </button>
          <button type="button" className="primary" onClick={() => choose('SKIM_BURY')}>
            Bury it — somewhere back in the deck
          </button>
        </div>
      </>
    )
  } else {
    stage = (
      <p className="hint">
        {skim.choice === 'kept'
          ? 'It waits on top. End the round.'
          : 'Gone — somewhere back in the deck. The next deal is unknown. End the round.'}
      </p>
    )
  }

  return (
    <div className="grid-picker skim-picker">
      <div className="grid-picker-head">
        <h2>SKIM</h2>
      </div>
      {/* The work beside the choice — keep or bury is a question about
          what the piece needs next. */}
      <div className="skim-body">
        {workUrl && (
          <figure className="work-glance">
            <img src={workUrl} alt="The work as it stands" />
            <figcaption className="hint">the work, as it stands</figcaption>
          </figure>
        )}
        <div className="skim-stage">{stage}</div>
      </div>
    </div>
  )
}

export function SkimTools({ ready }) {
  return (
    <span className="hint">
      {ready ? 'End the round.' : 'On the canvas: turn the top card, then leave it or bury it.'}
    </span>
  )
}
