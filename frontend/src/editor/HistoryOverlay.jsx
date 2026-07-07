// The deck overlay (v4): what has been spent, in sequence, and what remains
// to be pulled — the awareness that lets you compose toward what could
// still come. Modeled on KeysReference: a centered modal that swallows the
// app's keys at the capture phase while open; Esc or a click anywhere
// closes it.
//
// What it may show is decided in deck.js, not here: spentCards is the
// ordered past; remainingCounts arrives as an unordered multiset with the
// Coda already filtered out, so sequence and death timing stay secrets by
// construction. The one honest extra is the card in hand — dealt but not
// yet committed, it belongs to neither list.

import { useEffect, useState } from 'react'
import Card from './Card.jsx'
import CardZoom from './CardZoom.jsx'
import { remainingCounts, spentCards } from './deck.js'
import { UI } from '../copy/uiText.js'

const T = UI.deckOverlay

export default function HistoryOverlay({ state, onClose }) {
  // A clicked tile enlarges as CardZoom above this sheet. Esc backs out one
  // level at a time: the zoom first, the sheet only when nothing is zoomed.
  const [zoom, setZoom] = useState(null) // { id, label, kind } | null

  useEffect(() => {
    const onKeyDown = (e) => {
      e.stopPropagation() // modal: no app key acts behind it
      if (e.key === 'Escape') {
        if (zoom) setZoom(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose, zoom])

  const spent = spentCards(state)
  const remaining = remainingCounts(state)
  const inHand = state.phase === 'WORKING' ? state.currentCard : null

  return (
    <div className="deck-overlay" onClick={onClose}>
      {zoom && <CardZoom {...zoom} onClose={() => setZoom(null)} />}
      <div className="deck-sheet" role="dialog" aria-label="The deck">
        <h2>{T.title}</h2>

        <section className="deck-section">
          <h3>{T.spentTitle}</h3>
          {spent.length === 0 && !inHand ? (
            <p className="hint">{T.spentEmpty}</p>
          ) : (
            <div className="deck-row">
              {spent.map((c, i) => (
                <div className="deck-cell" key={`${c.id}-${i}`}>
                  <Card
                    id={c.id}
                    label={c.label}
                    kind={c.kind}
                    size="tile"
                    onClick={() => setZoom({ id: c.id, label: c.label, kind: c.kind })}
                  />
                  <span className="deck-cell-name">{c.label}</span>
                  {c.tag && <span className="deck-cell-tag">{c.tag}</span>}
                </div>
              ))}
              {inHand && (
                <div className="deck-cell">
                  <Card
                    id={inHand.id}
                    label={inHand.label}
                    size="tile"
                    dimmed
                    onClick={() => setZoom({ id: inHand.id, label: inHand.label })}
                  />
                  <span className="deck-cell-name">{inHand.label}</span>
                  <span className="deck-cell-tag">{T.inHand}</span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="deck-section">
          <h3>{T.remainsTitle}</h3>
          {remaining.length === 0 ? (
            <p className="hint">
              {state.deathShuffled && state.deck.length > 0 ? T.onlyCoda : T.modsSpent}
            </p>
          ) : (
            <div className="deck-row">
              {remaining.map((c) => (
                <div className="deck-cell" key={c.id}>
                  <Card
                    id={c.id}
                    label={c.label}
                    size="tile"
                    count={c.count}
                    onClick={() => setZoom({ id: c.id, label: c.label })}
                  />
                  <span className="deck-cell-name">{c.label}</span>
                </div>
              ))}
            </div>
          )}
          {state.deathShuffled && remaining.length > 0 && (
            <p className="hint">{T.codaSomewhere}</p>
          )}
        </section>

        <p className="hint">{T.close}</p>
      </div>
    </div>
  )
}
