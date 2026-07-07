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
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

const H = UI.cardHints.skim

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
        <p className="hint">{CARD_TEXT.skim.description}</p>
        <button type="button" className="primary" onClick={() => onDeckAction({ type: 'SKIM' })}>
          {H.turnTop}
        </button>
      </>
    )
  } else if (!skim.card) {
    stage = <p className="hint">{H.emptyDeck}</p>
  } else if (!skim.choice) {
    stage = (
      <>
        <Card id={skim.card.id} label={skim.card.label} kind={skim.card.kind} size="reveal" flip />
        <p className="hint">{H.choiceHint}</p>
        <div className="skim-choices">
          <button type="button" className="primary" onClick={() => choose('SKIM_KEEP')}>
            {H.keep}
          </button>
          <button type="button" className="primary" onClick={() => choose('SKIM_BURY')}>
            {H.bury}
          </button>
        </div>
      </>
    )
  } else {
    stage = <p className="hint">{skim.choice === 'kept' ? H.kept : H.buried}</p>
  }

  return (
    <div className="grid-picker skim-picker">
      <div className="grid-picker-head">
        <h2>{H.title}</h2>
      </div>
      {/* The work beside the choice — keep or bury is a question about
          what the piece needs next. */}
      <div className="skim-body">
        {workUrl && (
          <figure className="work-glance">
            <img src={workUrl} alt="The work as it stands" />
            <figcaption className="hint">{UI.shared.workGlance}</figcaption>
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
      {ready ? H.toolReady : H.toolWaiting}
    </span>
  )
}
