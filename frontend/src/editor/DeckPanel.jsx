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

import { useState } from 'react'
import { progressLabel } from './deck.js'
import Card from './Card.jsx'
import CardZoom from './CardZoom.jsx'
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
  onDeal,
  onCommit,
  onRestart,
  onOpenOutput,
  onOpenHistory
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
        <AwaitingDeal state={state} onDeal={onDeal} onOpenHistory={onOpenHistory} />
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
      <div className="panel-scroll">
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
      </div>
      <button
        type="button"
        className="primary commit"
        title="Enter"
        disabled={!placementReady}
        onClick={onEndPlacement}
      >
        {placementReady ? 'End — commit' : 'Loading images…'}
      </button>
    </aside>
  )
}

function AwaitingDeal({ state, onDeal, onOpenHistory }) {
  return (
    <aside className="deck-panel">
      <div className="panel-scroll">
        <h2>THE DECK</h2>
        <p className="hint">
          {state.deck.length} card{state.deck.length === 1 ? '' : 's'} remain
          {state.stash.length > 0 ? ` · ${state.stash.length} stashed` : ''}
        </p>
        <p className="hint">{progressLabel(state)}</p>
        {/* The moment you're deciding is the moment to consult the deck. */}
        <button type="button" className="secondary" onClick={onOpenHistory}>
          View the deck
        </button>
      </div>
      <button type="button" className="primary" title="Space" onClick={onDeal}>
        Deal
      </button>
    </aside>
  )
}

function CardRevealed({ state, entry, controls, info, ready, committing, onControlChange, onCommit }) {
  const card = state.currentCard
  const ToolsComponent = entry?.Tools
  const commitDisabled = !ready || committing
  const [zoomed, setZoomed] = useState(false)

  return (
    <aside className="deck-panel">
      {zoomed && (
        <CardZoom id={card.id} label={card.label} kind={card.kind} onClose={() => setZoomed(false)} />
      )}
      <div className="panel-scroll">
        <h2>THIS ROUND</h2>
        <Card
          id={card.id}
          label={card.label}
          kind={card.kind}
          size="panel"
          flip
          onClick={() => setZoomed(true)}
        />
        <p className="card-name">{card.label}</p>
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
      </div>
      <button type="button" className="primary commit" title="Enter" onClick={onCommit} disabled={commitDisabled}>
        {committing ? 'Committing…' : commitDisabled ? 'Setting up…' : 'End — commit'}
      </button>
    </aside>
  )
}

function Complete({ state, exportState, onRestart, onOpenOutput }) {
  const status = exportState?.status ?? 'idle'
  const [zoomed, setZoomed] = useState(false)
  const codaLabel = state.currentCard?.label ?? 'Coda'
  return (
    <aside className="deck-panel complete">
      {zoomed && (
        <CardZoom
          id={state.currentCard?.id ?? 'coda'}
          label={codaLabel}
          kind="death"
          onClose={() => setZoomed(false)}
        />
      )}
      <div className="panel-scroll">
        <h2>FINISHED</h2>
        <Card
          id={state.currentCard?.id ?? 'coda'}
          label={codaLabel}
          kind="death"
          size="panel"
          flip
          onClick={() => setZoomed(true)}
        />
        <p className="card-name">{codaLabel}</p>
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
      </div>
      <button type="button" className="primary" title="Enter" onClick={onRestart}>
        Start a new composition
      </button>
    </aside>
  )
}

export default DeckPanel
