import { useMemo, useState } from 'react'
import { MOD_CARDS } from './editor/deck.js'
import { CARD_TEXT } from './editor/cardText.js'
import Card from './editor/Card.jsx'
import CardZoom from './editor/CardZoom.jsx'
import './editor/editor.css' // base .card styles for the pool's face icons
import { UI, fmt } from './copy/uiText.js'

const T = UI.deckEditor

// Deck legality lives HERE, not in deck.js — the reducer never learns about
// the room (cards_plan.md §6); a session runs on any list it is handed.
// These numbers only gate what the room will hand it.
//
// The cap is the whole point: set-knowledge is free only while the set fits
// in your head. 20 was the rule before the pool grew and it holds (Stew,
// 2026-07-10) — the house deck was thinned to fit it exactly; the pool's
// growth (the Kid Pix cards) is what creates choices. The floor keeps a
// lean deck honest: acts consume actOneRounds + actTwoRounds = 6 cards
// before the death shuffle, so 12 leaves a real late game rather than an
// instant Coda.
export const DECK_CAP = 20
export const DECK_FLOOR = 12
export const MAX_COPIES = 3

// The house deck: today's dealt deck, MOD_CARDS verbatim. Further starting
// points (wash-heavy, graft-heavy, fracture-legal — cards_plan.md §6) land
// in this list as the pool grows to support them; one entry each.
const HOUSE_SPEC = MOD_CARDS.map(({ id, copies }) => ({ id, copies }))

function specToCounts(spec) {
  const counts = Object.fromEntries(MOD_CARDS.map((c) => [c.id, 0]))
  for (const { id, copies } of spec) {
    if (id in counts) counts[id] = Math.min(copies, MAX_COPIES)
  }
  return counts
}

function countsToSpec(counts) {
  // Pool order, zero-copy designs dropped — the [{ id, copies }] shape
  // deck.js expects.
  return MOD_CARDS.filter((c) => counts[c.id] > 0).map((c) => ({
    id: c.id,
    copies: counts[c.id]
  }))
}

function sameSpec(a, b) {
  return (
    a.length === b.length &&
    a.every((c, i) => c.id === b[i].id && c.copies === b[i].copies)
  )
}

// The deck editor — a room off the setup screen where the next session's
// deck is assembled under the cap. Its entire output is a deck spec handed
// back through onUse; saved decks persist per machine in ~/.deck-config.json
// via POST /api/decks (the whole list, replaced on every save).
function DeckEditor({ decks, active, onUse, onBack, onDecksSaved }) {
  const [counts, setCounts] = useState(() => specToCounts(active?.spec ?? HOUSE_SPEC))
  const [name, setName] = useState(active?.name && active.spec ? active.name : '')
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [zoom, setZoom] = useState(null) // the card whose face is open in the overlay

  const total = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    [counts]
  )
  const legal = total >= DECK_FLOOR && total <= DECK_CAP

  function step(id, delta) {
    setCounts((c) => ({
      ...c,
      [id]: Math.max(0, Math.min(MAX_COPIES, c[id] + delta))
    }))
  }

  async function persist(nextDecks) {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decks: nextDecks })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || res.statusText)
      onDecksSaved(data.decks)
    } catch (err) {
      setSaveError(fmt(T.saveFailed, { message: err.message }))
    } finally {
      setSaving(false)
    }
  }

  function saveDeck() {
    const deckName = name.trim()
    if (!deckName || !legal) return
    const entry = { name: deckName, cards: countsToSpec(counts) }
    const rest = decks.filter((d) => d.name !== deckName)
    persist([...rest, entry])
  }

  function useDeck() {
    const spec = countsToSpec(counts)
    if (sameSpec(spec, HOUSE_SPEC)) {
      onUse(null, T.houseDeckName) // null spec = the house deck, deck.js's own default
      return
    }
    onUse(spec, name.trim() || T.customDeckName)
  }

  return (
    <div className="deck-editor">
      <header>
        <button type="button" className="link" onClick={onBack}>
          {T.back}
        </button>
        <h1>{T.title}</h1>
        <p className="muted">{T.subtitle}</p>
      </header>

      <div className={`deck-count ${legal ? '' : 'illegal'}`}>
        {fmt(T.countLine, { count: total, cap: DECK_CAP, floor: DECK_FLOOR })}
        {total < DECK_FLOOR && <span className="deck-count-note">{T.tooFew}</span>}
        {total > DECK_CAP && <span className="deck-count-note">{T.tooMany}</span>}
      </div>

      <div className="deck-starting-points">
        <span className="field-label">{T.startingPointsLabel}</span>
        <button type="button" onClick={() => setCounts(specToCounts(HOUSE_SPEC))}>
          {T.houseDeckName}
        </button>
      </div>

      <ul className="deck-pool">
        {MOD_CARDS.map((card) => (
          <li key={card.id} className={counts[card.id] === 0 ? 'excluded' : ''}>
            <Card
              id={card.id}
              label={card.label}
              size="icon"
              onClick={() => setZoom(card)}
            />
            <div className="deck-pool-body">
              <div className="deck-pool-head">
                <span className="deck-pool-name">{card.label}</span>
                {card.family === 'deck' && <span className="deck-pool-tag">{T.deckCardTag}</span>}
                <span className="deck-pool-stepper">
                  <button
                    type="button"
                    onClick={() => step(card.id, -1)}
                    disabled={counts[card.id] === 0}
                    aria-label={`${card.label} −`}
                  >
                    −
                  </button>
                  <span className="deck-pool-copies">×{counts[card.id]}</span>
                  <button
                    type="button"
                    onClick={() => step(card.id, 1)}
                    disabled={counts[card.id] >= MAX_COPIES}
                    aria-label={`${card.label} +`}
                  >
                    +
                  </button>
                </span>
              </div>
              <small className="hint">{CARD_TEXT[card.id]?.description}</small>
            </div>
          </li>
        ))}
      </ul>

      <div className="deck-saved">
        <span className="field-label">{T.savedLabel}</span>
        {decks.length === 0 && <small className="hint">{T.savedEmpty}</small>}
        {decks.length > 0 && (
          <ul>
            {decks.map((d) => (
              <li key={d.name}>
                <span className="deck-saved-name">
                  {d.name}{' '}
                  <span className="muted">
                    ({d.cards.reduce((sum, c) => sum + c.copies, 0)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCounts(specToCounts(d.cards))
                    setName(d.name)
                  }}
                >
                  {T.load}
                </button>
                <button
                  type="button"
                  onClick={() => persist(decks.filter((x) => x.name !== d.name))}
                  disabled={saving}
                >
                  {T.delete}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={T.namePlaceholder}
            spellCheck={false}
          />
          <button type="button" onClick={saveDeck} disabled={saving || !name.trim() || !legal}>
            {T.save}
          </button>
        </div>
        {saveError && <small className="error">{saveError}</small>}
      </div>

      <button type="button" className="deck-use" onClick={useDeck} disabled={!legal}>
        {T.use}
      </button>

      {zoom && (
        <CardZoom id={zoom.id} label={zoom.label} onClose={() => setZoom(null)} />
      )}
    </div>
  )
}

export default DeckEditor
