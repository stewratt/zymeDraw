// Skim — the scry (v4 notes §5.2). Turn the top card of the deck over and
// make one choice: leave it (it's your next deal) or bury it (slipped back
// in somewhere random), never seeing what replaces it. Skim sees
// everything — once death is armed the top card can be the Coda, and
// keeping it is choosing your ending.
//
// Skim never touches the canvas: the reveal and the choice are deck
// actions; the round ends with a plain End (skipBake in the registry).
// And because they are deck actions, they RESOLVE AT THE DECK (issue #120):
// the top card turns face-up where it lies in the dock and the choice is
// made in the panel beside it. Nothing covers the canvas, because the whole
// question — what does the piece need next? — is asked of the piece itself.
// The turn is click-only, deliberately — Enter deals, and a double-press
// must never turn the card before you've registered that Skim arrived.

import { useEffect } from 'react'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

const H = UI.cardHints.skim

// The Ghost pattern: begin awaits the user so End stays disabled until
// the choice is made (or there is nothing to see). Tools resolves it
// through info.done after dispatching the choice.
export async function beginSkim(ctx) {
  await new Promise((resolve) => ctx.report({ done: resolve }))
  return null
}

// The registry's `dockCard` (issue #120): which card the dock turns face-up
// on top of the deck this round. Only while the choice is open — once it is
// made the card goes back down, kept or buried, and the deck is a deck again.
export function skimDockCard(deckView) {
  const skim = deckView?.skim
  return skim && !skim.choice ? skim.card : null
}

export function SkimTools({ info, deckView, onDeckAction }) {
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

  if (!skim) {
    return (
      <div className="skim-tools">
        <p className="hint">{CARD_TEXT.skim.description}</p>
        <button type="button" className="primary" onClick={() => onDeckAction({ type: 'SKIM' })}>
          {H.turnTop}
        </button>
      </div>
    )
  }
  if (!skim.card) return <span className="hint">{H.emptyDeck}</span>
  if (!skim.choice) {
    return (
      <div className="skim-tools">
        {/* The face is in the dock, named above itself (art may bury its own
            name, issue #50) — this side of the panel only asks the question. */}
        <p className="hint">{H.choiceHint}</p>
        <div className="skim-choices">
          <button type="button" className="primary" onClick={() => choose('SKIM_KEEP')}>
            {H.keep}
          </button>
          <button type="button" className="primary" onClick={() => choose('SKIM_BURY')}>
            {H.bury}
          </button>
        </div>
      </div>
    )
  }
  return <span className="hint">{skim.choice === 'kept' ? H.kept : H.buried}</span>
}
