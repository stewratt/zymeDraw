// The deck panel renders one view per session phase:
//   OPENING_ROLLS  → the two dice rolls (or folder loading/error states)
//   OPENING_PICK   → the image grid: take up to pickCount, place or stash each
//   PLACEMENT /
//   STASH_RETURN   → the placement session (stub until Phase 3) + End
//   WORKING        → Deal button, or the revealed card + Tools + End
//   COMPLETE       → the Coda: export status + restart
//
// It knows nothing about specific cards — it renders whatever Tools
// component the current registry entry provides (none yet in Phase 1).

import { useState } from 'react'
import { TUNING, progressLabel, rollNotation } from './deck.js'

function DeckPanel({
  state,
  imageList,
  entry,
  controls,
  info,
  ready,
  exportState,
  onControlChange,
  onRoll,
  onConfirmPick,
  onEndPlacement,
  onDeal,
  onCommit,
  onRestart,
  onOpenOutput
}) {
  switch (state.phase) {
    case 'OPENING_ROLLS':
      return <OpeningRolls imageList={imageList} onRoll={onRoll} />
    case 'OPENING_PICK':
      return <OpeningPick state={state} onConfirmPick={onConfirmPick} />
    case 'PLACEMENT':
    case 'STASH_RETURN':
      return <Placement state={state} onEndPlacement={onEndPlacement} />
    case 'WORKING':
      return state.currentCard ? (
        <CardRevealed
          state={state}
          entry={entry}
          controls={controls}
          info={info}
          ready={ready}
          onControlChange={onControlChange}
          onCommit={onCommit}
        />
      ) : (
        <AwaitingDeal state={state} onDeal={onDeal} />
      )
    case 'COMPLETE':
      return (
        <Complete
          state={state}
          exportState={exportState}
          onRestart={onRestart}
          onOpenOutput={onOpenOutput}
        />
      )
    default:
      return null
  }
}

function OpeningRolls({ imageList, onRoll }) {
  if (imageList.status === 'loading') {
    return (
      <aside className="deck-panel">
        <h2>THE OPENING</h2>
        <p className="hint">Loading input folder…</p>
      </aside>
    )
  }
  if (imageList.status === 'error') {
    return (
      <aside className="deck-panel">
        <h2>INPUT FOLDER ERROR</h2>
        <p className="error">{imageList.error}</p>
        <p className="hint">Go back to setup to pick a different folder.</p>
      </aside>
    )
  }
  if (imageList.filenames.length === 0) {
    return (
      <aside className="deck-panel">
        <h2>NO IMAGES FOUND</h2>
        <p className="hint">
          Add some <code>.png</code> / <code>.jpg</code> / <code>.jpeg</code> /{' '}
          <code>.webp</code> files to your input folder, then reload.
        </p>
      </aside>
    )
  }
  return (
    <aside className="deck-panel">
      <h2>THE OPENING</h2>
      <p className="hint">
        Two rolls set the opening: how many images are dealt out (
        {rollNotation(TUNING.gridRoll)}), and how many of them you may take (
        {rollNotation(TUNING.pickRoll)}).
      </p>
      <p className="hint">
        {imageList.filenames.length} image
        {imageList.filenames.length === 1 ? '' : 's'} in folder
      </p>
      <button type="button" className="primary" onClick={onRoll}>
        Roll
      </button>
    </aside>
  )
}

function OpeningPick({ state, onConfirmPick }) {
  // filename → 'place' | 'stash'. Clicking a chip cycles
  // unselected → place → stash → unselected.
  const [selection, setSelection] = useState({})

  const { grid, rolls } = state
  const placed = grid.filter((f) => selection[f] === 'place')
  const stashed = grid.filter((f) => selection[f] === 'stash')
  const taken = placed.length + stashed.length

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

  if (grid.length === 0) {
    return (
      <aside className="deck-panel">
        <h2>THE OPENING</h2>
        <p className="hint">Dealing images…</p>
      </aside>
    )
  }

  return (
    <aside className="deck-panel">
      <h2>THE OPENING</h2>
      <p className="hint">
        {grid.length} images dealt — take up to <strong>{rolls.pickCount}</strong>.
        Click each pick to cycle: <em>place now</em> → <em>stash for later</em> →
        back. At least one must be placed. (Thumbnails arrive in Phase 3.)
      </p>
      <div className="pick-grid">
        {grid.map((f) => (
          <button
            key={f}
            type="button"
            className={`pick-chip ${selection[f] || ''}`}
            onClick={() => cycle(f)}
          >
            <span className="pick-mark">
              {selection[f] === 'place' ? 'PLACE' : selection[f] === 'stash' ? 'STASH' : '·'}
            </span>
            <span className="pick-name">{f}</span>
          </button>
        ))}
      </div>
      <p className="hint">
        {placed.length} to place · {stashed.length} stashed · {taken} of{' '}
        {rolls.pickCount} taken
      </p>
      <button
        type="button"
        className="primary"
        disabled={placed.length < 1}
        onClick={() => onConfirmPick(placed, stashed)}
      >
        Continue — begin placement
      </button>
    </aside>
  )
}

function Placement({ state, onEndPlacement }) {
  const returning = state.phase === 'STASH_RETURN'
  return (
    <aside className="deck-panel">
      <h2>{returning ? 'STASH RETURN' : 'PLACEMENT'}</h2>
      <p className="hint">
        {returning
          ? 'Your stashed images come back — arrange them like the opening.'
          : 'Arrange your images on the canvas.'}{' '}
        Move, scale, rotate, and erase freely; End bakes them in.
      </p>
      <p className="hint">(Placement tools arrive in Phase 3 — this round is a stub.)</p>
      <ul className="placed-files">
        {state.toPlace.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <button type="button" className="primary commit" onClick={onEndPlacement}>
        End — commit
      </button>
    </aside>
  )
}

function AwaitingDeal({ state, onDeal }) {
  return (
    <aside className="deck-panel">
      <h2>THE DECK</h2>
      <p className="hint">
        {state.deck.length} card{state.deck.length === 1 ? '' : 's'} remain
        {state.stash.length > 0 ? ` · ${state.stash.length} stashed` : ''}
      </p>
      <p className="hint">{progressLabel(state)}</p>
      <button type="button" className="primary" onClick={onDeal}>
        Deal
      </button>
    </aside>
  )
}

function CardRevealed({ state, entry, controls, info, ready, onControlChange, onCommit }) {
  const card = state.currentCard
  const ToolsComponent = entry?.Tools
  const commitDisabled = !ready

  return (
    <aside className="deck-panel">
      <h2>THIS ROUND</h2>
      <div className={`card-face card-${card.kind}`}>
        <span className="card-kind">{card.kind === 'mod' ? 'modification' : card.kind}</span>
        <span className="card-label">{card.label}</span>
      </div>
      <div className="tool-area">
        {ToolsComponent ? (
          <ToolsComponent
            controls={controls}
            info={info}
            ready={ready}
            onControlChange={onControlChange}
          />
        ) : (
          <span className="hint">(placeholder — this card&apos;s tools arrive in a later phase)</span>
        )}
      </div>
      <button type="button" className="primary commit" onClick={onCommit} disabled={commitDisabled}>
        {commitDisabled ? 'Setting up…' : 'End — commit'}
      </button>
    </aside>
  )
}

function Complete({ state, exportState, onRestart, onOpenOutput }) {
  const status = exportState?.status ?? 'idle'
  return (
    <aside className="deck-panel complete">
      <h2>FINISHED</h2>
      <div className="card-face card-death">
        <span className="card-kind">the deck is done</span>
        <span className="card-label">{state.currentCard?.label ?? 'Coda'}</span>
      </div>
      <p className="hint">The piece is complete.</p>
      {status === 'exporting' && <p className="hint">Writing PNG to your output folder…</p>}
      {status === 'done' && (
        <>
          {exportState.thumbDataUrl && (
            <img src={exportState.thumbDataUrl} className="export-thumb" alt="Final composition" />
          )}
          <p className="hint">Saved to:</p>
          <p className="export-path mono">{exportState.savedPath}</p>
          <button type="button" className="secondary" onClick={onOpenOutput}>
            Open output folder
          </button>
        </>
      )}
      {status === 'error' && <p className="error">Export failed: {exportState.error}</p>}
      <button type="button" className="primary" onClick={onRestart}>
        Start a new composition
      </button>
    </aside>
  )
}

export default DeckPanel
