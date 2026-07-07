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

import { useEffect, useState } from 'react'
import { cardArtSources, useActiveCardSet } from './cardArt.js'
import { cardFamily } from './deck.js'

function Card({ id, label, kind = 'mod', size = 'panel', count, dimmed, flip, onClick, title }) {
  const activeSet = useActiveCardSet()
  const sources = cardArtSources(id, activeSet)
  // Walk the sources (active set → bundled) on image error; when exhausted,
  // `art` is undefined and the text face shows. Reset when the card or set
  // changes so a re-deal starts from the top.
  const [attempt, setAttempt] = useState(0)
  useEffect(() => setAttempt(0), [id, activeSet])
  const art = sources[attempt]
  // Mod cards split into two color-coded families (image vs deck) until
  // the designed faces carry the distinction; the Coda stays its own thing.
  const family = kind === 'mod' ? cardFamily(id) : null
  const classes = [
    'card',
    `card--${size}`,
    family && `card--family-${family}`,
    kind === 'death' && 'card--death',
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
      {art ? (
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
            {kind !== 'mod' ? 'the deck is done' : family === 'deck' ? 'the deck' : 'modification'}
          </span>
          <span className="card-label">{label}</span>
        </div>
      )}
      {count != null && <span className="card-count">×{count}</span>}
    </div>
  )
}

export default Card
