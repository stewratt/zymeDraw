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
import { UI, fmt } from '../copy/uiText.js'
import { rich } from '../copy/rich.jsx'

const T = UI.deckPanel

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
  stashTone,
  onStashToneChange,
  onDeal,
  onCommit,
  onAcceptCoda,
  onDelayCoda,
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
          stashTone={stashTone}
          onStashToneChange={onStashToneChange}
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
    case 'CODA_CHOICE':
      return <CodaChoice state={state} onAcceptCoda={onAcceptCoda} onDelayCoda={onDelayCoda} />
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
        <h2>{T.openingTitle}</h2>
        <p className="hint">{T.openingLoading}</p>
      </aside>
    )
  }
  if (imageList.status === 'error') {
    return (
      <aside className="deck-panel">
        <h2>{T.inputErrorTitle}</h2>
        <p className="error">{imageList.error}</p>
        <p className="hint">{T.inputErrorHint}</p>
      </aside>
    )
  }
  if (imageList.filenames.length === 0) {
    return (
      <aside className="deck-panel">
        <h2>{T.noImagesTitle}</h2>
        <p className="hint">{rich(T.noImagesHint)}</p>
      </aside>
    )
  }
  return (
    <aside className="deck-panel">
      <h2>{T.openingTitle}</h2>
      <p className="hint">{rich(T.openingHint)}</p>
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
  stashTone,
  onStashToneChange,
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
        <h2>{returning ? T.stashReturnTitle : T.placementTitle}</h2>
        <p className="hint">
          {returning ? T.stashReturnHint : T.placementHint}{' '}
          {brushing ? maskHint(maskControls.mode, UI.brush.placementSubject) : T.arrangeHint}{' '}
          {T.endBakes}
        </p>

        <div className="brush-tools">
          <ArrangeMaskControls
            controls={maskControls}
            info={{ ...maskHistory, undo: onMaskUndo, redo: onMaskRedo }}
            onControlChange={(key, value) => onMaskControlsChange({ [key]: value })}
          />
        </div>

        {/* The stash was chosen against a piece that has moved on — tone
            controls ease it into what the rounds since have made. */}
        {returning && (
          <div className="stash-tone">
            <label className="ctrl">
              <span className="ctrl-label">Hue</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={stashTone.h}
                onChange={(e) => onStashToneChange({ h: Number(e.target.value) })}
              />
              <span className="ctrl-value mono">{stashTone.h}°</span>
            </label>
            <label className="ctrl">
              <span className="ctrl-label">Saturation</span>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={stashTone.s}
                onChange={(e) => onStashToneChange({ s: Number(e.target.value) })}
              />
              <span className="ctrl-value mono">{stashTone.s}%</span>
            </label>
          </div>
        )}

        {placedLayers.length > 0 ? (
          <>
            {placedLayers.length >= 2 && (
              <p className="hint layers-hint">{T.reorderHint}</p>
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
        {placementReady ? T.endCommit : T.loadingImages}
      </button>
    </aside>
  )
}

function AwaitingDeal({ state, onDeal, onOpenHistory }) {
  return (
    <aside className="deck-panel">
      <div className="panel-scroll">
        <h2>{T.deckTitle}</h2>
        <p className="hint">
          {fmt(T.cardsRemain, { count: state.deck.length, plural: state.deck.length === 1 ? '' : 's' })}
          {state.stash.length > 0 ? ` ${fmt(T.stashedSuffix, { count: state.stash.length })}` : ''}
        </p>
        <p className="hint">{progressLabel(state)}</p>
        {/* The moment you're deciding is the moment to consult the deck. */}
        <button type="button" className="secondary" onClick={onOpenHistory}>
          {T.viewDeck}
        </button>
        {/* Deck state, not card behavior: the right Delay granted, visible
            where it matters — at the moment of the deal. */}
        {state.delayHeld && (
          <div className="delay-held">
            <Card id="delay" label={UI.cards.delay.name} size="tile" />
            <span className="hint">{T.delayHeld}</span>
          </div>
        )}
      </div>
      <button type="button" className="primary" title="Space" onClick={onDeal}>
        {T.deal}
      </button>
    </aside>
  )
}

// The Coda, dealt while Delay is held (deck.js CODA_CHOICE). Click-only,
// deliberately — Enter deals and commits everywhere else, and neither
// ending the piece nor refusing the ending should ever be a double-press
// accident. The canvas stays visible behind the panel: the question is
// about the piece, and the piece is right there.
function CodaChoice({ state, onAcceptCoda, onDelayCoda }) {
  const card = state.currentCard
  const [zoomed, setZoomed] = useState(false)
  return (
    <aside className="deck-panel">
      {zoomed && (
        <CardZoom id={card.id} label={card.label} kind="death" onClose={() => setZoomed(false)} />
      )}
      <div className="panel-scroll">
        <h2>{T.codaTitle}</h2>
        <Card id={card.id} label={card.label} kind="death" size="panel" flip onClick={() => setZoomed(true)} />
        <p className="card-name">{card.label}</p>
        <p className="hint">{T.codaHint}</p>
        <button type="button" className="secondary" onClick={onDelayCoda}>
          {T.codaSetAside}
        </button>
      </div>
      <button type="button" className="primary" onClick={onAcceptCoda}>
        {T.codaAccept}
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
        <CardZoom id={card.id} label={card.label} kind={card.kind} variant={card.variant} onClose={() => setZoomed(false)} />
      )}
      <div className="panel-scroll">
        <h2>{T.roundTitle}</h2>
        <Card
          id={card.id}
          label={card.label}
          kind={card.kind}
          variant={card.variant}
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
            <span className="hint">{T.toolsPlaceholder}</span>
          )}
        </div>
      </div>
      <button type="button" className="primary commit" title="Enter" onClick={onCommit} disabled={commitDisabled}>
        {committing ? T.committing : commitDisabled ? T.settingUp : T.endCommit}
      </button>
    </aside>
  )
}

function Complete({ state, exportState, onRestart, onOpenOutput }) {
  const status = exportState?.status ?? 'idle'
  const [zoomed, setZoomed] = useState(false)
  const codaLabel = state.currentCard?.label ?? UI.cards.coda.name
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
        <h2>{T.finishedTitle}</h2>
        <Card
          id={state.currentCard?.id ?? 'coda'}
          label={codaLabel}
          kind="death"
          size="panel"
          flip
          onClick={() => setZoomed(true)}
        />
        <p className="card-name">{codaLabel}</p>
        <p className="hint">{T.complete}</p>
        {status === 'exporting' && <p className="hint">{T.exporting}</p>}
        {status === 'done' && (
          <>
            {exportState.thumbDataUrl && (
              <img src={exportState.thumbDataUrl} className="export-thumb" alt="Final composition" />
            )}
            <p className="hint">{T.savedTo}</p>
            <p className="export-path mono">{exportState.savedPath}</p>
            <button type="button" className="secondary" onClick={onOpenOutput}>
              {T.openOutput}
            </button>
          </>
        )}
        {status === 'error' && <p className="error">{fmt(T.exportFailed, { error: exportState.error })}</p>}
      </div>
      <button type="button" className="primary" title="Enter" onClick={onRestart}>
        {T.restart}
      </button>
    </aside>
  )
}

export default DeckPanel
