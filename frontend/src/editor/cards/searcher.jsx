// Searcher — the tutor (v4 notes §5.1). The deck overlay's remains view,
// cashed in: while Searcher is in hand the undealt mods are laid out face
// up and you take any one — that card becomes this round. The Coda is never
// in the view and never pickable (remainingCounts filters it in deck.js,
// and the reducer only finds mods). (id `searcher`, was Cull.)
//
// Searcher never touches the canvas. The pick is a deck action
// (PICK_FROM_DECK): the reducer removes the chosen card and makes it
// current, which retires this overlay and begins the chosen card — so
// Searcher has no commit, no cleanup, and skipBake in its registry entry.

import { useEffect, useState } from 'react'
import Card from '../Card.jsx'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

const H = UI.cardHints.searcher

// The Ghost pattern: begin awaits the user, so End stays disabled while
// the remains are open. Normally the pick swaps the current card and this
// promise is simply cancelled; done() only fires for the empty-remains
// round (deck exhausted to deaths), where End is the round's whole
// content — and `ready` doubles as that round's flag for the panel.
export async function beginSearcher(ctx) {
  await new Promise((resolve) => ctx.report({ done: resolve }))
  return null
}

export function SearcherOverlay({ info, deckView, onDeckAction, workUrl }) {
  const remaining = deckView?.remaining ?? []
  const [chosen, setChosen] = useState(null) // a card id, or null

  // Enter takes once a card is chosen; Esc puts it back — the same
  // manners as a card image grid (hotkeys.md §9.3).
  useEffect(() => {
    const onKeyDown = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter' && chosen) {
        e.preventDefault()
        onDeckAction({ type: 'PICK_FROM_DECK', cardId: chosen })
      } else if (e.key === 'Escape') {
        setChosen(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [chosen, onDeckAction])

  // The rare empty round: nothing left to take, End is the only move.
  const empty = remaining.length === 0
  useEffect(() => {
    if (empty) info?.done?.()
  }, [empty, info])

  return (
    <div className="grid-picker searcher-picker">
      <div className="grid-picker-head">
        <h2>{H.title}</h2>
        <p className="hint">
          {empty ? H.emptyDeck : CARD_TEXT.searcher.description}
        </p>
      </div>
      {!empty && (
        <>
          {/* The work beside the choice — you're picking FOR the piece as
              it stands, so it stands right there. */}
          <div className="searcher-body">
            {workUrl && (
              <figure className="work-glance">
                <img src={workUrl} alt="The work as it stands" />
                <figcaption className="hint">{UI.shared.workGlance}</figcaption>
              </figure>
            )}
            <div className="deck-row searcher-row">
              {remaining.map((c) => (
                <div className={`deck-cell${chosen === c.id ? ' chosen' : ''}`} key={c.id}>
                  <Card
                    id={c.id}
                    label={c.label}
                    size="tile"
                    count={c.count}
                    title="Take it"
                    onClick={() => setChosen((cur) => (cur === c.id ? null : c.id))}
                  />
                  <span className="deck-cell-name">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid-picker-foot">
            <span className="hint">{chosen ? H.footChosen : H.footTakeOne}</span>
            <button
              type="button"
              className="primary"
              title="Enter"
              disabled={!chosen}
              onClick={() => onDeckAction({ type: 'PICK_FROM_DECK', cardId: chosen })}
            >
              {H.confirm}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function SearcherTools({ ready }) {
  return (
    <span className="hint">
      {ready ? H.toolReady : H.toolWaiting}
    </span>
  )
}
