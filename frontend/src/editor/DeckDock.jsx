// The deck dock — the one way a turn ends, in BOTH wings (issues #87, #98).
// The deck of backs on the left, the card drawn from it face-up on the right,
// the count and the standing instruction beneath. Pinned at the foot of the
// panel so it never moves between phases: placement, a card round and the
// waiting beat all click in the same place.
//
// Shared infrastructure, so it lives here rather than inside either panel:
// DeckPanel (the composition wing) and FoundryPanel (the Foundry) render the
// same component, and a change to the dock reaches both at once.
//
// PARAMETERIZED BY PROPS ONLY — there is no `wing` flag and no branch on who
// is rendering it. Everything that differs between the two wings arrives as a
// prop, and the props for mechanics one wing doesn't have (`stashCount`,
// `delayHeld`, `notice`) default to off, so the Foundry simply omits them. The dock
// knows what is in hand and what a click means; it never knows which session
// it is in.
//
// `dealKey` changes on every deal — it remounts the flip so the animation
// replays even when one card follows another with no empty beat between.

import { useEffect } from 'react'
import Card from './Card.jsx'
import { playCardFlip } from './sound.js'
import { UI, fmt } from '../copy/uiText.js'

// The dock's own lines are studio verbs both wings speak (the same reason
// FoundryPanel reads Deck's panel copy for THIS ROUND and Committing…).
const T = UI.deckPanel

function DeckDock({
  card,
  dealKey,
  deckCount,
  stashCount = 0,
  hint,
  actionLabel,
  disabled,
  delayHeld = false,
  notice = null,
  onDraw,
  onZoomCard
}) {
  return (
    <div className="deck-dock">
      {/* One slot for the held right (issue #114): the token while it stands,
          and the notice that takes its place the moment it is spent, so the
          dock announces the loss instead of silently emptying. The same slot
          carries the arc beats (issue #119) — one line at a time, the newest
          one, and the token comes back when the line clears. Deck state,
          not card behavior — the right Delay granted, standing with the deck
          it will be spent against. It lived at the old deal panel; with no
          between-rounds beat left, the dock is where it is always in view. */}
      {notice ? (
        <p className="hint dock-notice">{notice}</p>
      ) : delayHeld ? (
        <div className="delay-held">
          <Card id="delay" label={UI.cards.delay.name} size="tile" />
          <span className="hint">{T.delayHeld}</span>
        </div>
      ) : null}
      <div className="deck-pair">
        <div className="deck-slot">
          <button
            type="button"
            className="deck-stack"
            onClick={onDraw}
            disabled={disabled}
            // Every keyed control names its key on hover (hotkeys.md §5).
            title={`${actionLabel} — Enter`}
            aria-label={actionLabel}
          >
            {/* Two backs behind the top one: the deck reads as a stack of
                cards rather than a single one. Decorative — the whole
                button is the target. */}
            <span className="deck-stack-under deck-stack-under--2" aria-hidden="true">
              <Card faceDown />
            </span>
            <span className="deck-stack-under deck-stack-under--1" aria-hidden="true">
              <Card faceDown />
            </span>
            <Card faceDown />
          </button>
        </div>
        {/* Empty until a card is drawn. The columns are fixed, so the deck
            sits in the same place whether or not anything lies beside it. */}
        <div className="deck-slot">
          {card && <DealtCard key={dealKey} card={card} onZoom={onZoomCard} />}
        </div>
      </div>
      <p className="hint deck-dock-line">
        {fmt(T.cardsRemain, { count: deckCount, plural: deckCount === 1 ? '' : 's' })}
        {stashCount > 0 ? ` ${fmt(T.stashedSuffix, { count: stashCount })}` : ''}
      </p>
      <p className="hint deck-dock-line">{hint}</p>
    </div>
  )
}

// The deal, made visible: the back and the face share one box and the wrapper
// turns over, so what you see is the card you just drew flipping face-up out
// of the deck. Motion only — both sides render through Card.jsx, which keeps
// owning the geometry. Duration and easing are issue #59's to tune.
function DealtCard({ card, onZoom }) {
  // `dealKey` remounts this on every deal, so mounting *is* the turn over —
  // the sound rides the animation rather than the click that started it.
  useEffect(() => {
    playCardFlip()
  }, [])
  return (
    <div className="deal-flip">
      <div className="deal-flip-inner">
        <Card
          id={card.id}
          label={card.label}
          kind={card.kind}
          variant={card.variant}
          onClick={onZoom}
        />
        <Card faceDown />
      </div>
    </div>
  )
}

export default DeckDock
