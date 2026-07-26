// The one card visual. Every card face in the app renders through this
// component at the same fixed proportions (745 × 1040, the designed-deck
// scale) — art when it exists, the text face when it doesn't. Nothing else
// may hardcode card geometry.
//
// Sizes: 'panel' (the dealt card in the deck panel), 'tile' (the deck
// overlay), 'zoom' (the enlarged view). `flip` plays the deal animation;
// `count` badges a multiset entry; `dimmed` marks context (the card in
// hand, not yet committed). `onClick` makes the face clickable — the
// consumers use it to open CardZoom; propagation stops here so a tile
// click never falls through to a close-on-click overlay behind it.
//
// `faceDown` turns the card over: the one back, the ZYME mark on a flat
// field and nothing else. It reuses this frame so the back can never drift
// from the geometry the faces are cut to.

import { useEffect, useState } from 'react'
import { cardArtSources, useActiveCardSet } from './cardArt.js'
import { cardFamily } from './deck.js'
import { playCardFlip } from './sound.js'

function Card({
  id,
  label,
  kind = 'mod',
  size = 'panel',
  count,
  dimmed,
  flip,
  faceDown,
  onClick,
  title,
  variant = 1
}) {
  const activeSet = useActiveCardSet()
  const sources = cardArtSources(id, activeSet, variant)
  // Walk the sources (active set → bundled, variant face → bare) on image
  // error; when exhausted, `art` is undefined and the text face shows. Reset
  // when the card, set, or variant changes so a re-deal starts from the top.
  const [attempt, setAttempt] = useState(0)
  useEffect(() => setAttempt(0), [id, activeSet, variant])
  // The flip is the turn separator, so the sound belongs to the animation
  // rather than to any one panel: every card that turns over here — the Stash
  // Return notice, the Coda — sounds, and a new one gets it for free. The
  // dock's dealt card flips through its own wrapper and plays its own.
  useEffect(() => {
    if (flip) playCardFlip()
  }, [flip])
  const art = sources[attempt]
  // Mod cards split into two color-coded families (image vs deck) until
  // the designed faces carry the distinction; the Coda and the Stash Return
  // card stay their own things (kind 'death' / 'stash').
  const family = kind === 'mod' && !faceDown ? cardFamily(id) : null
  const classes = [
    'card',
    `card--${size}`,
    family && `card--family-${family}`,
    faceDown && 'card--back',
    kind === 'death' && !faceDown && 'card--death',
    dimmed && 'card--dimmed',
    flip && 'card--flip',
    onClick && 'card--clickable'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      title={onClick ? (title ?? 'View larger') : undefined}
      onClick={
        onClick &&
        ((e) => {
          e.stopPropagation()
          onClick()
        })
      }
    >
      {faceDown ? (
        // Decorative: the mark says "a card, face down", which the frame
        // already says — naming it again would only clutter a screen reader.
        <div className="card-back">
          <img className="card-back-mark" src="/logo/zyme.png" alt="" draggable={false} />
        </div>
      ) : art ? (
        <img
          className="card-art"
          src={art}
          alt={label}
          draggable={false}
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <div className="card-text-face">
          <span className="card-kind">
            {kind === 'death'
              ? 'the deck is done'
              : kind === 'stash'
                ? 'the stash'
                : family === 'deck'
                  ? 'the deck'
                  : 'modification'}
          </span>
          <span className="card-label">{label}</span>
        </div>
      )}
      {count != null && <span className="card-count">×{count}</span>}
    </div>
  )
}

export default Card
