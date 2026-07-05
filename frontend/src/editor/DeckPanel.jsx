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
import { ArrangeMaskControls, maskHint } from './cards/maskControls.jsx'

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
  maskControls,
  maskHistory,
  onMaskControlsChange,
  onMaskUndo,
  onMaskRedo,
  exportState,
  onControlChange,
  onEndPlacement,
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
          maskControls={maskControls}
          maskHistory={maskHistory}
          onMaskControlsChange={onMaskControlsChange}
          onMaskUndo={onMaskUndo}
          onMaskRedo={onMaskRedo}
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
        // Editor auto-deals the moment a round ends; this renders for at
        // most a frame. A card-draw animation will live here later.
        <aside className="deck-panel">
          <h2>THIS ROUND</h2>
        </aside>
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
  maskControls,
  maskHistory,
  onMaskControlsChange,
  onMaskUndo,
  onMaskRedo,
  onEndPlacement
}) {
  const returning = state.phase === 'STASH_RETURN'
  const brushing = maskControls.mode !== 'arrange'
  return (
    <aside className="deck-panel">
      <h2>{returning ? 'STASH RETURN' : 'PLACEMENT'}</h2>
      <p className="hint">
        {returning
          ? 'Your stashed image comes back — arrange it like the opening.'
          : 'Arrange your image.'}{' '}
        {brushing
          ? maskHint(maskControls.mode, 'an image')
          : 'Drag to move, corner handles to scale, top handle to rotate.'}{' '}
        End bakes everything in for good.
      </p>

      <div className="brush-tools">
        <ArrangeMaskControls
          controls={maskControls}
          info={{ ...maskHistory, undo: onMaskUndo, redo: onMaskRedo }}
          onControlChange={(key, value) => onMaskControlsChange({ [key]: value })}
        />
      </div>

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
      <p className="hint">{progressLabel(state)}</p>
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
