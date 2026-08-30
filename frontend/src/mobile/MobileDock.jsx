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

// The FIT button sits beside the deck, outside it: with a free camera (Wave 3)
// a two-finger gesture can carry the page anywhere, and the way home has to be
// one tap and always in the same place. Plainly named, per the legibility
// clause — a navigation utility, not a card.
//
// `topCard` is the registry's `dockCard` (issue #120), arriving here the way it
// arrives at the desktop's DeckDock: the DECK'S OWN top card, turned face-up
// where it lies, so a card whose round is a look at what's next (Skim) resolves
// AT THE DECK and never covers the piece. The face replaces the top back in the
// stack and names itself above the bar — card art may bury its own name (issue
// #50) and the choice has to know what it is deciding on. The stack is still the
// whole tap target; while the reveal is open the deck is disabled by the round
// itself (Skim's begin awaits the choice), which is why the face keeps full
// strength while the button is dimmed.
//
// `delayHeld` is the same standing right the desktop dock shows: a small
// face-up Delay beside the line that says what it buys, replaced by the dock
// notice the moment it is spent.

import Card from '../editor/Card.jsx'
import { UI, fmt } from '../copy/uiText.js'

const T = UI.deckPanel
const M = UI.mobile

function MobileDock({
  card,
  topCard = null,
  deckCount,
  stashCount = 0,
  progress,
  hint,
  notice,
  delayHeld = false,
  actionLabel,
  disabled,
  onDraw,
  onFit
}) {
  return (
    <div className="m-dock">
      {/* One slot, same order as the desktop dock: the passing notice outranks
          the standing token, and the token comes back when the line clears. */}
      {notice ? (
        <p className="hint m-dock-notice">{notice}</p>
      ) : delayHeld ? (
        <div className="m-dock-delay">
          <Card id="delay" label={UI.cards.delay.name} size="tile" />
          <span className="hint">{T.delayHeld}</span>
        </div>
      ) : null}
      {topCard && <p className="m-dock-turn">{topCard.label}</p>}
      <div className="m-dock-row">
        <button
          type="button"
          className={topCard ? 'm-deck m-deck--turned' : 'm-deck'}
          onClick={onDraw}
          disabled={disabled}
          aria-label={actionLabel}
        >
          <span className="m-deck-stack" aria-hidden={!topCard}>
            <span className="m-deck-under m-deck-under--2">
              <Card faceDown size="tile" />
            </span>
            <span className="m-deck-under m-deck-under--1">
              <Card faceDown size="tile" />
            </span>
            {topCard ? (
              <Card
                id={topCard.id}
                label={topCard.label}
                kind={topCard.kind}
                variant={topCard.variant}
                size="tile"
                flip
              />
            ) : (
              <Card faceDown size="tile" />
            )}
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
        <button type="button" className="m-fit" onClick={onFit} aria-label={M.fitHint} title={M.fitHint}>
          {M.fitLabel}
        </button>
      </div>
    </div>
  )
}

export default MobileDock
