// The image grid picker — a canvas-area overlay for choosing images.
// First consumer: the opening pick (place-or-stash). Ghost and Stamp reuse
// the grid later with single-pick behavior.
//
// Opens with the dice-styled roll reveal. The rolls are already decided in
// deck.js by the time this mounts — the tumble is presentation only, which
// is also what keeps a future physical-dice mode possible.
//
// Owns its selection state; reports the final choice via onConfirm(placed,
// stashed). It never touches the deck reducer or the canvas.

import { useEffect, useState } from 'react'
import { TUNING } from './deck.js'

const TUMBLE_MS = 900
const SETTLE_PAUSE_MS = 800

function Die({ sides, value, tumbling }) {
  const [face, setFace] = useState(value)
  useEffect(() => {
    if (!tumbling) {
      setFace(value)
      return
    }
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * sides)), 80)
    return () => clearInterval(t)
  }, [tumbling, sides, value])
  return (
    <div className={`die ${tumbling ? '' : 'settled'}`}>
      <span className="die-sides">d{sides}</span>
      <span className="die-face">{face}</span>
    </div>
  )
}

function GridPicker({ rolls, grid, onConfirm }) {
  const [stage, setStage] = useState('tumble') // tumble → settled → grid
  // filename → 'place' | 'stash'. Clicking a thumb cycles
  // unselected → place → stash → unselected.
  const [selection, setSelection] = useState({})

  useEffect(() => {
    const t1 = setTimeout(() => setStage('settled'), TUMBLE_MS)
    const t2 = setTimeout(() => setStage('grid'), TUMBLE_MS + SETTLE_PAUSE_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const placed = grid.filter((f) => selection[f] === 'place')
  const stashed = grid.filter((f) => selection[f] === 'stash')

  function cycle(filename) {
    setSelection((prev) => {
      const cur = prev[filename]
      if (!cur) {
        if (Object.keys(prev).length >= rolls.pickCount) return prev // hand is full
        return { ...prev, [filename]: 'place' }
      }
      if (cur === 'place') return { ...prev, [filename]: 'stash' }
      const next = { ...prev }
      delete next[filename]
      return next
    })
  }

  const summary =
    `grid ${TUNING.gridRoll.base} + ${rolls.gridDie} = ${rolls.gridSize} images · ` +
    `take up to ${TUNING.pickRoll.base} + ${rolls.pickDie} = ${rolls.pickCount}`

  if (stage !== 'grid') {
    return (
      <div className="grid-picker dice-stage">
        <h2>THE OPENING</h2>
        <div className="dice-row">
          <Die sides={TUNING.gridRoll.die} value={rolls.gridDie} tumbling={stage === 'tumble'} />
          <Die sides={TUNING.pickRoll.die} value={rolls.pickDie} tumbling={stage === 'tumble'} />
        </div>
        <p className={`dice-summary ${stage === 'settled' ? 'shown' : ''}`}>{summary}</p>
      </div>
    )
  }

  return (
    <div className="grid-picker">
      <div className="grid-picker-head">
        <h2>THE OPENING</h2>
        <p className="hint">
          {summary}. Click an image to cycle: <em>place now</em> → <em>stash for later</em> → pass.
        </p>
      </div>
      {grid.length === 0 ? (
        <p className="hint">Dealing images…</p>
      ) : (
        <div className="grid-thumbs">
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
      )}
      <div className="grid-picker-foot">
        <span className="hint">
          {placed.length} to place · {stashed.length} stashed · {placed.length + stashed.length} of{' '}
          {rolls.pickCount} taken
        </span>
        <button
          type="button"
          className="primary"
          disabled={placed.length < 1}
          onClick={() => onConfirm(placed, stashed)}
        >
          Continue — begin placement
        </button>
      </div>
    </div>
  )
}

export default GridPicker
