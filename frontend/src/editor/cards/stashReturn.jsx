// Stash Return (issue #88) — the card that brings the held-back image home.
//
// The only card whose beat is a PHASE rather than a round: the deal itself
// puts the session in STASH_RETURN_NOTICE (deck.js), exactly as a dealt Coda
// lands on COMPLETE. So this file holds no lifecycle hooks — the placement
// it opens is the shared stash-return session Editor already runs for
// STASH_RETURN (image load, mask brush, tone, universal bake), which this
// card triggers rather than reimplements.
//
// What lives here is the card's own panel: the interstitial the user must
// click through before the placement goes live. Deliberately click-only —
// Enter (the draw key) has no binding in this phase — so a fast double-press
// can't blow through the re-encounter and commit the stash unseen.

import { useState } from 'react'
import Card from '../Card.jsx'
import CardZoom from '../CardZoom.jsx'
import { UI } from '../../copy/uiText.js'

const T = UI.deckPanel

export function StashReturnNotice({ card, onAck }) {
  const [zoomed, setZoomed] = useState(false)
  const id = card?.id ?? 'stashReturn'
  const label = card?.label ?? UI.cards.stashReturn.name
  return (
    <aside className="deck-panel">
      {zoomed && <CardZoom id={id} label={label} kind="stash" onClose={() => setZoomed(false)} />}
      <div className="panel-scroll">
        <h2>{T.stashReturnNoticeTitle}</h2>
        {/* The card that did this, face-up: the beat is the card, so it
            reads the same way a drawn card always does. */}
        <Card id={id} label={label} kind="stash" size="panel" flip onClick={() => setZoomed(true)} />
        <p className="card-name">{label}</p>
        <p className="hint">{T.stashReturnNoticeHint}</p>
      </div>
      <button type="button" className="primary" onClick={onAck}>
        {T.stashReturnNoticeButton}
      </button>
    </aside>
  )
}
