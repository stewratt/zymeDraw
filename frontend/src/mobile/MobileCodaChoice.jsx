// The Coda, held (deck.js CODA_CHOICE) — the beat Delay bought.
//
// Only reachable while the right is held: the Coda has been dealt and waits
// on an explicit choice instead of ending the piece where it lies.
//
// It sits where the tools sheet and the deck dock sit, and takes both their
// places for this beat — so the canvas stays visible above it. That is the
// desktop's own reason for keeping this in the panel rather than over the
// canvas: the question is about the piece, and the piece is right there.
//
// CLICK-ONLY, deliberately, exactly as on the desktop: the deck is the button
// everywhere else, and neither ending the piece nor refusing the ending should
// ever be something a fast double-tap does for you. The dock is gone entirely
// while this stands, so there is no third way out to tap through.

import Card from '../editor/Card.jsx'
import { UI } from '../copy/uiText.js'

const T = UI.deckPanel

function MobileCodaChoice({ card, onAccept, onSetAside }) {
  return (
    <div className="m-coda">
      <div className="m-coda-head">
        {card && <Card id={card.id} label={card.label} kind="death" size="tile" flip />}
        <div className="m-coda-titles">
          <h2>{T.codaTitle}</h2>
          <p className="m-coda-name">{card?.label ?? UI.cards.coda.name}</p>
        </div>
      </div>
      <p className="hint">{T.codaHint}</p>
      <div className="m-coda-actions">
        <button type="button" className="primary" onClick={onAccept}>
          {T.codaAccept}
        </button>
        <button type="button" className="secondary" onClick={onSetAside}>
          {T.codaSetAside}
        </button>
      </div>
    </div>
  )
}

export default MobileCodaChoice
