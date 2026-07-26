// The deck panel renders one view per session phase:
//   OPENING_PICK   → a summary (or folder loading/error states); the actual
//                    grid is GridPicker over the canvas
//   PLACEMENT /
//   STASH_RETURN   → the placement session instructions + the deck
//   WORKING        → the drawn card + its Tools, above the deck
//   COMPLETE       → the Coda: export status + restart
//
// The deck is the button (issue #87): every phase that advances the session
// ends the same way — one click on the deck dock pinned at the panel's foot,
// which commits what's in hand and turns the next card over. There are no
// End or Deal buttons. Only the Coda keeps its own finish/export flow;
// nothing follows it, so the deck is not the exit there. The dock itself is
// shared with the Foundry (editor/DeckDock.jsx, issue #98).
//
// It knows nothing about specific cards — it renders whatever Tools
// component the current registry entry provides.

import { useState } from 'react'
import { progressLabel } from './deck.js'
import Card from './Card.jsx'
import DeckDock from './DeckDock.jsx'
import CardZoom from './CardZoom.jsx'
import PlacementLayers from './PlacementLayers.jsx'
import { ArrangeMaskControls, maskHint } from './cards/maskControls.jsx'
import { StashReturnNotice } from './cards/stashReturn.jsx'
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
  committed,
  onGateCommit,
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
  onAdvance,
  stashTone,
  onStashToneChange,
  onAcceptCoda,
  onDelayCoda,
  onRestart,
  onOpenOutput,
  onOpenHistory
}) {
  switch (state.phase) {
    case 'OPENING_PICK':
      return <OpeningPickPanel imageList={imageList} />
    case 'STASH_RETURN_NOTICE':
      // The beat belongs to the Stash Return card, so its panel lives with
      // the card (cards/stashReturn.jsx) — this is a phase, not a branch on
      // which card is in hand. No dock and no button: the preview page over
      // the canvas holds the image and the one action (issue #93), the way
      // the opening grid holds the pick and its confirm.
      return <StashReturnNotice card={state.currentCard} />
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
          onAdvance={onAdvance}
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
          committed={committed}
          onGateCommit={onGateCommit}
          committing={committing}
          onControlChange={onControlChange}
          onAdvance={onAdvance}
        />
      ) : (
        <AwaitingDeal state={state} onAdvance={onAdvance} onOpenHistory={onOpenHistory} />
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
  onAdvance
}) {
  const returning = state.phase === 'STASH_RETURN'
  const brushing = maskControls.mode !== 'arrange'
  return (
    <aside className="deck-panel">
      <div className="panel-scroll">
        <h2>{returning ? T.stashReturnTitle : T.placementTitle}</h2>
        <p className="hint">
          {returning ? T.stashReturnHint : T.placementHint}{' '}
          {brushing ? maskHint(maskControls.mode, UI.brush.placementSubject) : T.arrangeHint}
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
      <DeckDock
        deckCount={state.deck.length}
        stashCount={returning ? 0 : state.stash.length}
        hint={placementReady ? T.deckHintPlacement : T.loadingImages}
        actionLabel={T.deckDrawAction}
        disabled={!placementReady}
        delayHeld={state.delayHeld}
        onDraw={onAdvance}
      />
    </aside>
  )
}

// Nothing in hand: the beat after a Coda is set aside, and the state the
// session rests in if a deal ever finds an empty deck. One click on the deck
// draws — there is nothing to commit first.
function AwaitingDeal({ state, onAdvance, onOpenHistory }) {
  return (
    <aside className="deck-panel">
      <div className="panel-scroll">
        <h2>{T.deckTitle}</h2>
        <p className="hint">{progressLabel(state)}</p>
        {/* The moment you're deciding is the moment to consult the deck. */}
        <button type="button" className="secondary" onClick={onOpenHistory}>
          {T.viewDeck}
        </button>
      </div>
      <DeckDock
        deckCount={state.deck.length}
        stashCount={state.stash.length}
        hint={T.deckHintIdle}
        actionLabel={T.deckDrawIdle}
        delayHeld={state.delayHeld}
        onDraw={onAdvance}
      />
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

// The card in hand: its name and Tools stack above the pair, the face itself
// lies in the dock beside the deck it came out of.
//
// A card may declare a commit gate (registry `commitGate`): its session runs
// as usual, but it commits on the labelled button at the foot of the panel —
// just above the dock — instead of on the deck click. Until that press the
// deck says plainly that drawing lets the card pass; after it the round rests
// on its result and the deck is only the next deal. All of it reads from the
// registry, so this is still a panel that knows nothing about any card.
function CardRevealed({ state, entry, controls, info, ready, committed, onGateCommit, committing, onControlChange, onAdvance }) {
  const card = state.currentCard
  const ToolsComponent = entry?.Tools
  const gate = entry?.commitGate
  const gateOpen = !!gate && !committed // the button is up; the deck would pass
  const commitDisabled = !ready || committing
  const [zoomed, setZoomed] = useState(false)

  return (
    <aside className="deck-panel">
      {zoomed && (
        <CardZoom id={card.id} label={card.label} kind={card.kind} variant={card.variant} onClose={() => setZoomed(false)} />
      )}
      <div className="panel-scroll">
        <h2>{T.roundTitle}</h2>
        <p className="card-name">{card.label}</p>
        <div className="tool-area">
          {ToolsComponent ? (
            <ToolsComponent
              controls={controls}
              info={info}
              ready={ready}
              committed={committed}
              onControlChange={onControlChange}
            />
          ) : (
            <span className="hint">{T.toolsPlaceholder}</span>
          )}
        </div>
      </div>
      {gateOpen && (
        <button type="button" className="primary" onClick={onGateCommit} disabled={commitDisabled}>
          {gate.label}
        </button>
      )}
      <DeckDock
        card={card}
        // A card arrives either straight after a commit (roundsDealt just
        // moved) or by being searched out mid-round (the id changes) — so
        // this pair is a different string for every card that turns over.
        dealKey={`${state.roundsDealt}:${card.id}:${card.variant ?? 1}`}
        deckCount={state.deck.length}
        stashCount={state.stash.length}
        hint={
          committing
            ? T.committing
            : !ready
              ? T.settingUp
              : gateOpen
                ? T.deckHintGate
                : committed
                  ? T.deckHintIdle
                  : T.deckHintActive
        }
        actionLabel={gateOpen ? T.deckDrawGate : committed ? T.deckDrawIdle : T.deckDrawAction}
        disabled={commitDisabled}
        delayHeld={state.delayHeld}
        onDraw={onAdvance}
        onZoomCard={() => setZoomed(true)}
      />
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
