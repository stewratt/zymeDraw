// Stash Return (issue #88) — the card that brings the held-back image home.
//
// The only card whose beat is a PHASE rather than a round: the deal itself
// puts the session in STASH_RETURN_NOTICE (deck.js), exactly as a dealt Coda
// lands on COMPLETE. So this file holds no lifecycle hooks — the placement
// it opens is the shared stash-return session Editor already runs for
// STASH_RETURN (image load, mask brush, tone, universal bake), which this
// card triggers rather than reimplements.
//
// What lives here is the beat itself, in two halves — the interstitial the
// user must click through before the placement goes live:
//
//   StashReturnPreview  the full-view page over the canvas (issue #93): the
//     stashed image, seen before it lands, in the card grids' page chrome.
//   StashReturnNotice   the side panel beside it: the card that did this,
//     face-up.
//
// The page owns the action, the panel only reports — the opening pick's
// division exactly (GridPicker confirms; OpeningPickPanel is a summary), and
// for the same reason: the image is the whole beat, so the button belongs
// where the image is.
//
// Deliberately click-only — Enter (the draw key) has no binding in this
// phase — so a fast double-press can't blow through the re-encounter and
// commit the stash unseen. And there is no second button: the stash always
// comes home when its card is drawn, so the page offers no way to put it
// back and no deck to draw past it (issue #93).

import { useState } from 'react'
import Card from '../Card.jsx'
import CardZoom from '../CardZoom.jsx'
import { UI } from '../../copy/uiText.js'

const T = UI.deckPanel
const P = UI.cardHints.stashReturn

// The stash, before it becomes live. Display only: no grid, no selection, no
// deck — the images are shown whole (the card grids crop their thumbs square
// to compare them; here there is nothing to compare, only what is arriving).
export function StashReturnPreview({ files = [], onAck }) {
  return (
    <div className="grid-picker">
      <div className="grid-picker-head">
        <h2>{P.previewTitle}</h2>
        <p className="hint">{P.previewHint}</p>
      </div>
      <div className="stash-preview-fit">
        {files.map((f) => (
          <img
            key={f}
            className="stash-preview"
            src={`/api/images/${encodeURIComponent(f)}`}
            alt={f}
          />
        ))}
      </div>
      <div className="grid-picker-foot">
        <span className="hint">{P.previewFoot}</span>
        <button type="button" className="primary" onClick={onAck}>
          {P.confirm}
        </button>
      </div>
    </div>
  )
}

export function StashReturnNotice({ card }) {
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
    </aside>
  )
}
