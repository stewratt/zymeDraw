// The image grid picker — a canvas-area overlay for choosing images.
// First consumer: the opening pick (place-or-stash). Ghost and Stamp reuse
// the grid with single-pick behavior (CardGridPicker below).
//
// The opening deals a fixed grid (TUNING.openingGrid) and the rule is
// strict: take two — one placed now, one stashed for later. The meaningful
// choice is *which*, not *how many*.
//
// Owns its selection state; reports the final choice via onConfirm(placed,
// stashed). It never touches the deck reducer or the canvas.

import { useEffect, useState } from 'react'
import { isFormTarget } from './keymap.js'

function GridPicker({ grid, onConfirm }) {
  // filename → 'place' | 'stash'. Clicking a thumb cycles
  // unselected → place → stash → unselected, skipping a role another
  // image already holds — there is exactly one of each.
  const [selection, setSelection] = useState({})

  // Esc backs out of the picks (hotkeys.md §5.1). Enter deliberately does
  // NOT confirm the opening — that choice stays explicit and mouse-made.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || isFormTarget(e)) return
      setSelection({})
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const placed = grid.filter((f) => selection[f] === 'place')
  const stashed = grid.filter((f) => selection[f] === 'stash')

  function cycle(filename) {
    setSelection((prev) => {
      const cur = prev[filename]
      const placeFree = !Object.entries(prev).some(([f, v]) => v === 'place' && f !== filename)
      const stashFree = !Object.entries(prev).some(([f, v]) => v === 'stash' && f !== filename)
      const next = { ...prev }
      if (!cur) {
        if (placeFree) next[filename] = 'place'
        else if (stashFree) next[filename] = 'stash'
        return next
      }
      if (cur === 'place' && stashFree) {
        next[filename] = 'stash'
        return next
      }
      delete next[filename]
      return next
    })
  }

  const ready = placed.length === 1 && stashed.length === 1

  return (
    <div className="grid-picker">
      <div className="grid-picker-head">
        <h2>THE OPENING</h2>
        <p className="hint">
          Take two: one to <em>place now</em>, one to <em>stash for later</em>. Click an image to
          cycle place → stash → pass.
        </p>
      </div>
      {grid.length === 0 ? (
        <p className="hint">Dealing images…</p>
      ) : (
        <div className="grid-thumbs-fit">
          <div className="grid-thumbs opening">
            {grid.map((f) => (
              <button
                key={f}
                type="button"
                className={`grid-thumb ${selection[f] || ''}`}
                onClick={() => cycle(f)}
              >
                <img src={`/api/images/${encodeURIComponent(f)}`} alt={f} loading="lazy" />
                {selection[f] && (
                  <span className="thumb-badge">{selection[f] === 'place' ? 'PLACE' : 'STASH'}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid-picker-foot">
        <span className="hint">
          {placed.length ? '1 to place' : 'place —'} · {stashed.length ? '1 stashed' : 'stash —'}
        </span>
        <button
          type="button"
          className="primary"
          disabled={!ready}
          onClick={() => onConfirm(placed, stashed)}
        >
          Continue — begin placement
        </button>
      </div>
    </div>
  )
}

// Single-pick variant for cards that deal their own grid (Ghost, Stamp).
// No stash: click an image to take it (click again to put it back), then
// confirm.
export function CardGridPicker({ title, hint, files, confirmLabel, onConfirm }) {
  const [chosen, setChosen] = useState(null)

  // Enter confirms once an image is taken — a card grid is a smaller
  // decision than the opening, which keeps its no-Enter rule (hotkeys.md
  // §9.3). Esc puts the image back.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isFormTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter' && chosen) {
        e.preventDefault()
        onConfirm(chosen)
      } else if (e.key === 'Escape') {
        setChosen(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [chosen, onConfirm])

  return (
    <div className="grid-picker">
      <div className="grid-picker-head">
        <h2>{title}</h2>
        <p className="hint">{hint}</p>
      </div>
      {files.length === 0 ? (
        <p className="hint">Dealing images…</p>
      ) : (
        <div className="grid-thumbs">
          {files.map((f) => (
            <button
              key={f}
              type="button"
              className={`grid-thumb ${chosen === f ? 'place' : ''}`}
              onClick={() => setChosen((c) => (c === f ? null : f))}
            >
              <img src={`/api/images/${encodeURIComponent(f)}`} alt={f} loading="lazy" />
              {chosen === f && <span className="thumb-badge">TAKE</span>}
            </button>
          ))}
        </div>
      )}
      <div className="grid-picker-foot">
        <span className="hint">{chosen ? '1 taken' : 'take one'}</span>
        <button type="button" className="primary" title="Enter" disabled={!chosen} onClick={() => onConfirm(chosen)}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

export default GridPicker
