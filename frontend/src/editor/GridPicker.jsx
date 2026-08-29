// The image grid picker — a canvas-area overlay for choosing images.
// First consumer: the opening pick (place-or-stash). Ghost and Stamp reuse
// the grid with single-pick behavior (CardGridPicker below).
//
// The opening deals a fixed grid (TUNING.openingGrid) and the rule is:
// take two — place one and stash one, or place both (then no stash beat
// this session). The meaningful choice is *which*, not *how many*.
//
// Owns its selection state; reports the final choice via onConfirm(placed,
// stashed). It never touches the deck reducer or the canvas.

import { useEffect, useState } from 'react'
import { isFormTarget } from './keymap.js'
import { imageUrl } from './imageStore.js'
import { UI, fmt } from '../copy/uiText.js'
import { rich } from '../copy/rich.jsx'

const T = UI.opening

function GridPicker({ grid, onConfirm }) {
  // filename → 'place' | 'stash'. The first pick is a place (click again
  // to put it back); the second pick cycles stash → place → back. A stash
  // never exists without a place — deselecting the place promotes it.
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
      const next = { ...prev }
      if (cur === 'stash') {
        // The second pick's cycle: stash → place (both placed, no stash).
        next[filename] = 'place'
        return next
      }
      if (cur === 'place') {
        delete next[filename]
        // Never a stash without a place: the remaining pick steps up.
        for (const f of Object.keys(next)) if (next[f] === 'stash') next[f] = 'place'
        return next
      }
      const taken = Object.keys(prev).length
      if (taken >= 2) return prev // two is the whole opening
      next[filename] = taken === 0 ? 'place' : 'stash'
      return next
    })
  }

  const ready = placed.length + stashed.length === 2

  return (
    <div className="grid-picker">
      <div className="grid-picker-head">
        <h2>{T.title}</h2>
        <p className="hint">{rich(T.hint)}</p>
      </div>
      {grid.length === 0 ? (
        <p className="hint">{T.dealing}</p>
      ) : (
        <div className="grid-thumbs-fit">
          <div className="grid-thumbs" style={{ '--cols': 6, '--rows': 4 }}>
            {grid.map((f) => (
              <button
                key={f}
                type="button"
                className={`grid-thumb ${selection[f] || ''}`}
                onClick={() => cycle(f)}
              >
                <img src={imageUrl(f)} alt={f} loading="lazy" />
                {selection[f] && (
                  <span className="thumb-badge">{selection[f] === 'place' ? T.badgePlace : T.badgeStash}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid-picker-foot">
        <span className="hint">
          {placed.length ? fmt(T.footPlaceCount, { count: placed.length }) : T.footPlaceNone} ·{' '}
          {stashed.length ? T.footStashed : placed.length === 2 ? T.footNoStash : T.footStashNone}
        </span>
        <button
          type="button"
          className="primary"
          disabled={!ready}
          onClick={() => onConfirm(placed, stashed)}
        >
          {T.confirm}
        </button>
      </div>
    </div>
  )
}

// Rows/columns for a card grid of n images. The images are the entire
// decision, so the shape aims for the biggest cells the canvas area allows
// (it's wider than tall): 6 → 3×2, 8 → 4×2, 12 → 4×3. The opening keeps
// its own fixed 6×4 and doesn't use this.
function gridShape(n) {
  if (n <= 3) return { cols: Math.max(n, 1), rows: 1 }
  if (n <= 8) return { cols: Math.ceil(n / 2), rows: 2 }
  return { cols: Math.ceil(n / 3), rows: 3 }
}

// Single-pick variant for cards that deal their own grid (Ghost, Stamp).
// No stash: click an image to take it (click again to put it back), then
// confirm. `fileUrl` maps an entry to its image URL — Deck's default is the
// session's image store; Foundry's panel pick passes its own (mixed
// input/output sources, panelArt.js).
//
// Two confirm shapes: pass `confirmLabel` for a self-owned foot button, OR
// pass `onChoose` to lift the selection out (Foundry drives the take from
// its side panel instead). Either way Enter still confirms via `onConfirm`.
export function CardGridPicker({
  title,
  hint,
  files,
  confirmLabel,
  onConfirm,
  onChoose,
  fileUrl = imageUrl
}) {
  const [chosen, setChosen] = useState(null)
  const shape = gridShape(files.length)

  // Report the live selection up (fires on mount/reset with null too, so an
  // external owner always tracks the current pick).
  useEffect(() => {
    onChoose?.(chosen)
  }, [chosen, onChoose])

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
        <p className="hint">{T.dealing}</p>
      ) : (
        <div className="grid-thumbs-fit">
          <div className="grid-thumbs" style={{ '--cols': shape.cols, '--rows': shape.rows }}>
            {files.map((f) => (
              <button
                key={f}
                type="button"
                className={`grid-thumb ${chosen === f ? 'place' : ''}`}
                onClick={() => setChosen((c) => (c === f ? null : f))}
              >
                <img src={fileUrl(f)} alt={f} loading="lazy" />
                {chosen === f && <span className="thumb-badge">{T.badgeTake}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid-picker-foot">
        <span className="hint">{chosen ? T.footTaken : T.footTakeOne}</span>
        {confirmLabel && (
          <button type="button" className="primary" title="Enter" disabled={!chosen} onClick={() => onConfirm(chosen)}>
            {confirmLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export default GridPicker
