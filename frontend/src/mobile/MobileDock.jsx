// The deck dock — pinned at the bottom edge, in the thumb.
//
// The deck is the button (issue #87), and on a phone it is the better
// interaction: one tap commits what is in hand and turns the next card over.
// So the whole bar is the tap target — the stack of backs, the card drawn
// beside it, and the line that says what a tap will do.
//
// Faces render through Card.jsx like every card face in the app; the geometry
// stays that component's (CLAUDE.md §6). The desktop's DeckDock is not reused
// because its two-column layout is a sidebar's shape, not a bar's — but
// nothing about the mechanic differs, and the copy is the shared copy.

import Card from '../editor/Card.jsx'
import { UI, fmt } from '../copy/uiText.js'

const T = UI.deckPanel

function MobileDock({ card, deckCount, stashCount = 0, progress, hint, notice, actionLabel, disabled, onDraw }) {
  return (
    <div className="m-dock">
      {notice && <p className="hint m-dock-notice">{notice}</p>}
      <button
        type="button"
        className="m-deck"
        onClick={onDraw}
        disabled={disabled}
        aria-label={actionLabel}
      >
        <span className="m-deck-stack" aria-hidden="true">
          <span className="m-deck-under m-deck-under--2">
            <Card faceDown size="tile" />
          </span>
          <span className="m-deck-under m-deck-under--1">
            <Card faceDown size="tile" />
          </span>
          <Card faceDown size="tile" />
        </span>
        <span className="m-deck-face">
          {card && <Card id={card.id} label={card.label} kind={card.kind} variant={card.variant} size="tile" />}
        </span>
        <span className="m-deck-text">
          <span className="m-deck-action">{actionLabel}</span>
          {card && <span className="m-deck-card-name">{card.label}</span>}
          <span className="m-deck-meta">
            {fmt(T.cardsRemain, { count: deckCount, plural: deckCount === 1 ? '' : 's' })}
            {stashCount > 0 ? ` ${fmt(T.stashedSuffix, { count: stashCount })}` : ''}
            {progress ? ` · ${progress}` : ''}
          </span>
          {hint && <span className="m-deck-hint">{hint}</span>}
        </span>
      </button>
    </div>
  )
}

export default MobileDock
