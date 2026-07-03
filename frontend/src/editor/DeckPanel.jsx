// The deck panel renders one view per session phase:
//   OPENING_PICK   → a summary (or folder loading/error states); the actual
//                    grid is GridPicker over the canvas
//   PLACEMENT /
//   STASH_RETURN   → the placement session instructions + End
//   WORKING        → Deal button, or the revealed card + Tools + End
//   COMPLETE       → the Coda: export status + restart
//
// It knows nothing about specific cards — it renders whatever Tools
// component the current registry entry provides.

import { progressLabel } from './deck.js'
import PlacementLayers from './PlacementLayers.jsx'

function DeckPanel({
  state,
  imageList,
  entry,
  controls,
  info,
  ready,
  committing,
  placementReady,
  placedLayers,
  onReorderLayer,
  eraseControls,
  eraseHistory,
  onEraseControlsChange,
  onEraseUndo,
  onEraseRedo,
  exportState,
  onControlChange,
  onEndPlacement,
  onDeal,
  onCommit,
  onRestart,
  onOpenOutput
}) {
  switch (state.phase) {
    case 'OPENING_PICK':
      return <OpeningPickPanel imageList={imageList} />
    case 'PLACEMENT':
    case 'STASH_RETURN':
      return (
        <Placement
          state={state}
          placementReady={placementReady}
          placedLayers={placedLayers}
          onReorderLayer={onReorderLayer}
          eraseControls={eraseControls}
          eraseHistory={eraseHistory}
          onEraseControlsChange={onEraseControlsChange}
          onEraseUndo={onEraseUndo}
          onEraseRedo={onEraseRedo}
          onEndPlacement={onEndPlacement}
        />
      )
    case 'WORKING':
      return state.currentCard ? (
        <CardRevealed
          state={state}
          entry={entry}
          controls={controls}
          info={info}
          ready={ready}
          committing={committing}
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

function OpeningPickPanel({ imageList }) {
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
        Take <strong>two</strong> from the grid: one placed now, one stashed —
        it comes back after Act I.
      </p>
    </aside>
  )
}

function Placement({
  state,
  placementReady,
  placedLayers,
  onReorderLayer,
  eraseControls,
  eraseHistory,
  onEraseControlsChange,
  onEraseUndo,
  onEraseRedo,
  onEndPlacement
}) {
  const returning = state.phase === 'STASH_RETURN'
  const erasing = eraseControls.mode === 'erase'
  return (
    <aside className="deck-panel">
      <h2>{returning ? 'STASH RETURN' : 'PLACEMENT'}</h2>
      <p className="hint">
        {returning
          ? 'Your stashed images come back — arrange them like the opening.'
          : 'Arrange your images.'}{' '}
        {erasing
          ? 'Paint over an image to erase it; the topmost image under your first touch takes the whole stroke.'
          : 'Drag to move, corner handles to scale, top handle to rotate.'}{' '}
        End bakes everything in for good.
      </p>

      <div className="mode-toggle">
        <button
          type="button"
          className={erasing ? '' : 'active'}
          onClick={() => onEraseControlsChange({ mode: 'arrange' })}
        >
          Arrange
        </button>
        <button
          type="button"
          className={erasing ? 'active' : ''}
          disabled={!placementReady}
          onClick={() => onEraseControlsChange({ mode: 'erase' })}
        >
          Erase
        </button>
      </div>

      {erasing && (
        <div className="brush-tools">
          <label className="ctrl">
            <span className="ctrl-label">Size</span>
            <input
              type="range"
              min="6"
              max="150"
              value={eraseControls.size}
              onChange={(e) => onEraseControlsChange({ size: Number(e.target.value) })}
            />
            <span className="ctrl-value mono">{eraseControls.size}px</span>
          </label>
          <label className="ctrl">
            <span className="ctrl-label">Strength</span>
            <input
              type="range"
              min="5"
              max="100"
              value={Math.round((eraseControls.strength ?? 1) * 100)}
              onChange={(e) => onEraseControlsChange({ strength: Number(e.target.value) / 100 })}
            />
            <span className="ctrl-value mono">{Math.round((eraseControls.strength ?? 1) * 100)}%</span>
          </label>
          <div className="mode-toggle small">
            <button
              type="button"
              className={eraseControls.hardness === 'soft' ? 'active' : ''}
              onClick={() => onEraseControlsChange({ hardness: 'soft' })}
            >
              Soft
            </button>
            <button
              type="button"
              className={eraseControls.hardness === 'hard' ? 'active' : ''}
              onClick={() => onEraseControlsChange({ hardness: 'hard' })}
            >
              Hard
            </button>
          </div>
          <div className="undo-row">
            <button type="button" className="secondary" disabled={!eraseHistory.canUndo} onClick={onEraseUndo}>
              Undo
            </button>
            <button type="button" className="secondary" disabled={!eraseHistory.canRedo} onClick={onEraseRedo}>
              Redo
            </button>
          </div>
        </div>
      )}

      {placedLayers.length > 0 ? (
        <>
          {placedLayers.length >= 2 && (
            <p className="hint layers-hint">Drag to reorder the stack.</p>
          )}
          <PlacementLayers layers={placedLayers} onReorder={onReorderLayer} />
        </>
      ) : (
        <ul className="placed-files">
          {state.toPlace.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="primary commit"
        disabled={!placementReady}
        onClick={onEndPlacement}
      >
        {placementReady ? 'End — commit' : 'Loading images…'}
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

function CardRevealed({ state, entry, controls, info, ready, committing, onControlChange, onCommit }) {
  const card = state.currentCard
  const ToolsComponent = entry?.Tools
  const commitDisabled = !ready || committing

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
        {committing ? 'Committing…' : commitDisabled ? 'Setting up…' : 'End — commit'}
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
