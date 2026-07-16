// The Foundry panel — one view per session phase, mirror of DeckPanel:
//   COMMISSION / PLATE_DEAL → a summary; the pick overlays live on the canvas
//   PANEL_PICK / TYPE_SETTING → the live-foundation phases (stubs until
//                               Phases 3–4) + Continue / the Press
//   WORKING     → Deal, or the revealed card + Tools + End
//   COMPLETE    → the Proof: export status + cast another
//
// It knows nothing about specific cards — it renders whatever Tools
// component the current foundryRegistry entry provides.

import { foundryProgressLabel } from './foundryDeck.js'
import Card from '../editor/Card.jsx'
import { ArrangeMaskControls, maskHint } from '../editor/cards/maskControls.jsx'
import { UI, fmt } from '../copy/uiText.js'
import { rich } from '../copy/rich.jsx'

// F is Foundry's own copy; T is Deck's panel copy — the shared studio verbs
// (End — commit, Deal, THIS ROUND…) deliberately read the same in both apps.
const F = UI.foundry
const T = UI.deckPanel

function FoundryPanel({
  state,
  entry,
  controls,
  info,
  ready,
  committing,
  plateReady,
  plateTint,
  onPlateTint,
  onSetRunSize,
  artReady,
  artSources,
  onRedealGrid,
  onChoosePanelFolder,
  typeReady,
  inkTarget,
  onInk,
  onRerollFonts,
  onNextImpression,
  maskControls,
  maskHistory,
  onMaskControlsChange,
  onMaskUndo,
  onMaskRedo,
  onRepick,
  panelChoice,
  onTakePanel,
  exportState,
  onControlChange,
  onEndPanel,
  onPress,
  onDeal,
  onCommit,
  onRestart,
  onOpenOutput
}) {
  switch (state.phase) {
    case 'COMMISSION':
      return (
        <aside className="deck-panel">
          <h2>{F.commission.title}</h2>
          <p className="hint">{F.commission.panelHint}</p>
        </aside>
      )

    case 'PLATE_DEAL':
      return (
        <aside className="deck-panel">
          <h2>{F.plate.title}</h2>
          <p className="hint">{rich(fmt(F.plate.panelHint, { label: state.commission.label }))}</p>
          <RunSizeControl value={state.copiesTotal} onChange={onSetRunSize} />
        </aside>
      )

    case 'PANEL_PICK': {
      const hasArt = !!state.panelArt
      const brushing = maskControls.mode !== 'arrange'
      // The far-right primary is the progression button in both states: before
      // art it TAKES the grid pick (there is always an image for the window —
      // no artless skip); after art it advances to the type. Enter mirrors it
      // (the grid overlay's own listener confirms the pick pre-art).
      const nextBtn = hasArt
        ? {
            label: !plateReady ? F.panel.mounting : !artReady ? F.panel.placingArt : F.panel.continueType,
            disabled: !(plateReady && artReady),
            onClick: onEndPanel
          }
        : {
            label: !plateReady ? F.panel.mounting : F.panel.gridConfirm,
            disabled: !(plateReady && panelChoice),
            onClick: onTakePanel
          }
      return (
        <aside className="deck-panel">
          <div className="panel-scroll">
            <h2>{F.panel.title}</h2>
            {!hasArt ? (
              <>
                <p className="hint">{F.panel.pickPanelHint}</p>
                <button type="button" className="secondary" title="N" onClick={onRedealGrid}>
                  {F.panel.redealImages}
                </button>
                <p className="hint">
                  {artSources?.panelFolder ? (
                    <>
                      {F.panel.artFromPrefix}{' '}
                      <span className="mono">{artSources.panelFolder}</span>
                    </>
                  ) : (
                    F.panel.artFromFallback
                  )}
                </p>
                <button type="button" className="secondary" onClick={onChoosePanelFolder}>
                  {F.panel.chooseArtFolder}
                </button>
              </>
            ) : (
              <>
                <p className="hint">
                  {F.panel.arrangeHint}{' '}
                  {brushing
                    ? maskHint(maskControls.mode, F.panel.subject)
                    : T.arrangeHint}{' '}
                  {F.panel.liveUntilPress}
                </p>
                <div className="brush-tools">
                  <ArrangeMaskControls
                    controls={maskControls}
                    info={{ ...maskHistory, undo: onMaskUndo, redo: onMaskRedo }}
                    onControlChange={(key, value) => onMaskControlsChange({ [key]: value })}
                  />
                </div>
                <button type="button" className="secondary" onClick={onRepick}>
                  {F.panel.repick}
                </button>
              </>
            )}
            {plateReady && <PlateTintControl tint={plateTint} onChange={onPlateTint} />}
          </div>
          <button
            type="button"
            className="primary"
            title="Enter"
            disabled={nextBtn.disabled}
            onClick={nextBtn.onClick}
          >
            {nextBtn.label}
          </button>
        </aside>
      )
    }

    case 'TYPE_SETTING':
      return (
        <aside className="deck-panel">
          <div className="panel-scroll">
            <h2>{F.type.title}</h2>
            <p className="hint">{rich(F.type.hint)}</p>
            {state.typeFonts && (
              <div className="foundry-fonts">
                <p className="hint">
                  {F.type.dealtStyle} <strong>{state.typeFonts.style}</strong>
                  <br />
                  {fmt(F.type.titleFontLine, { name: state.typeFonts.title.name })}
                  <br />
                  {fmt(F.type.bodyFontLine, { name: state.typeFonts.body.name })}
                </p>
                <button type="button" className="secondary" title="N" onClick={onRerollFonts}>
                  {F.type.redealFonts}
                </button>
              </div>
            )}
            {typeReady && <InkControl inkTarget={inkTarget} onInk={onInk} />}
            {plateReady && <PlateTintControl tint={plateTint} onChange={onPlateTint} />}
            <p className="hint">{F.type.pressNote}</p>
          </div>
          <button
            type="button"
            className="primary"
            disabled={!plateReady || !typeReady}
            onClick={onPress}
          >
            {typeReady ? F.type.pressButton : F.type.settingType}
          </button>
        </aside>
      )

    case 'WORKING':
      return state.currentCard ? (
        <RoundPanel
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
        <aside className="deck-panel">
          <div className="panel-scroll">
            <h2>{F.working.title}</h2>
            <p className="hint">
              {fmt(T.cardsRemain, { count: state.deck.length, plural: state.deck.length === 1 ? '' : 's' })}
            </p>
            <p className="hint">{foundryProgressLabel(state)}</p>
          </div>
          <button type="button" className="primary" title="Space" onClick={onDeal}>
            {T.deal}
          </button>
        </aside>
      )

    case 'COMPLETE':
      return (
        <Proofed
          state={state}
          exportState={exportState}
          onRestart={onRestart}
          onNextImpression={onNextImpression}
          onOpenOutput={onOpenOutput}
        />
      )

    default:
      return null
  }
}

// The print run is set up here, at the plate (issue #36): an explicit
// choice, not inherited from anywhere. Reducer-owned — the stepper
// dispatches SET_RUN_SIZE and reads state.copiesTotal back; taking the
// plate fixes it. Plain "Run", per the legibility clause.
function RunSizeControl({ value, onChange }) {
  return (
    <div className="foundry-run">
      <span className="ctrl-label">{F.plate.runLabel}</span>
      <div className="foundry-run-stepper">
        <button
          type="button"
          className="secondary"
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          title="One impression fewer"
        >
          −
        </button>
        <span className="foundry-run-value mono">{value}</span>
        <button
          type="button"
          className="secondary"
          onClick={() => onChange(value + 1)}
          title="One impression more"
        >
          +
        </button>
      </div>
      <p className="hint">{F.plate.runHint}</p>
    </div>
  )
}

// The plate's own bath (plates.tintPlate): hue and saturation, live from
// the moment the plate mounts until the Press seals it — part of the
// foundation's standing control, adjustable on every cast. The art under
// the window is untouched; only the plate re-colors.
function PlateTintControl({ tint, onChange }) {
  return (
    <div className="foundry-ink">
      <p className="hint">{F.plateTint.hint}</p>
      <label className="ctrl">
        <span className="ctrl-label">Hue</span>
        <input
          type="range"
          min="-180"
          max="180"
          value={tint.h}
          onChange={(e) => onChange({ h: Number(e.target.value) })}
        />
        <span className="ctrl-value mono">{tint.h}°</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Saturation</span>
        <input
          type="range"
          min="0"
          max="200"
          value={tint.s}
          onChange={(e) => onChange({ s: Number(e.target.value) })}
        />
        <span className="ctrl-value mono">{tint.s}%</span>
      </label>
      {(tint.h !== 0 || tint.s !== 100) && (
        <button type="button" className="secondary" onClick={() => onChange({ h: 0, s: 100 })}>
          {F.plateTint.asPrinted}
        </button>
      )}
    </div>
  )
}

// The type ink (typeLayer.inkSlot): a free color plus two studio presets.
// With a slot selected on the canvas it inks that slot alone; with nothing
// selected it inks the whole layer — dark plates get light type, and slots
// can differ on one card.
const SLOT_LABELS = {
  name: F.ink.slotName,
  typeLine: F.ink.slotTypeLine,
  description: F.ink.slotDescription,
  rarity: F.ink.slotRarity
}

function InkControl({ inkTarget, onInk }) {
  return (
    <div className="foundry-ink">
      <p className="hint">
        {F.ink.prefix}{' '}
        <strong>{inkTarget ? SLOT_LABELS[inkTarget] ?? inkTarget : F.ink.allSlots}</strong>
        {!inkTarget && ` ${F.ink.selectNote}`}
      </p>
      <div className="foundry-ink-row">
        <input
          type="color"
          defaultValue="#141414"
          onChange={(e) => onInk(e.target.value)}
          title="Ink color"
        />
        <button type="button" className="secondary" onClick={() => onInk('#141414')}>
          {F.ink.ink}
        </button>
        <button type="button" className="secondary" onClick={() => onInk('#f2efe8')}>
          {F.ink.bone}
        </button>
      </div>
    </div>
  )
}

function RoundPanel({ state, entry, controls, info, ready, committing, onControlChange, onCommit }) {
  const card = state.currentCard
  const ToolsComponent = entry?.Tools
  const commitDisabled = !ready || committing
  return (
    <aside className="deck-panel">
      <div className="panel-scroll">
        <h2>{T.roundTitle}</h2>
        <Card id={card.id} label={card.label} kind={card.kind} size="panel" flip />
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
            <span className="hint">{F.working.placeholder}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="primary commit"
        title="Enter"
        onClick={onCommit}
        disabled={commitDisabled}
      >
        {committing ? T.committing : commitDisabled ? T.settingUp : T.endCommit}
      </button>
    </aside>
  )
}

function Proofed({ state, exportState, onRestart, onNextImpression, onOpenOutput }) {
  const status = exportState?.status ?? 'idle'
  const run = state.copiesTotal > 1
  const remaining = state.copyIndex < state.copiesTotal
  return (
    <aside className="deck-panel complete">
      <div className="panel-scroll">
        <h2>
          {run
            ? fmt(F.proof.titleRun, { i: state.copyIndex, n: state.copiesTotal })
            : F.proof.title}
        </h2>
        <Card id="proof" label={F.proof.cardLabel} kind="death" size="panel" flip />
        <p className="card-name">{F.proof.cardLabel}</p>
        <p className="hint">
          {run
            ? rich(
                fmt(F.proof.impressionCast, {
                  i: state.copyIndex,
                  label: state.commission.label,
                  tail: remaining ? F.proof.tailNext : F.proof.tailComplete
                })
              )
            : rich(fmt(F.proof.faceCast, { label: state.commission.label }))}
        </p>
        {status === 'exporting' && <p className="hint">{F.proof.exporting}</p>}
        {status === 'done' && (
          <>
            {exportState.thumbDataUrl && (
              <img src={exportState.thumbDataUrl} className="export-thumb" alt="The cast face" />
            )}
            <p className="hint">{T.savedTo}</p>
            <p className="export-path mono">{exportState.savedPath}</p>
            <p className="hint">
              {rich(
                fmt(F.proof.dropIn, {
                  // Copy 1 (or a single cast) is the bare face; later
                  // impressions curate as the opt-in `<id>.n.png` variant
                  // (card_anatomy.md §5 home #4).
                  file:
                    state.copyIndex > 1
                      ? `${state.commission.id}.${state.copyIndex}.png`
                      : `${state.commission.id}.png`
                })
              )}
            </p>
            <button type="button" className="secondary" onClick={onOpenOutput}>
              {T.openOutput}
            </button>
          </>
        )}
        {status === 'error' && <p className="error">{fmt(T.exportFailed, { error: exportState.error })}</p>}
      </div>
      {remaining ? (
        <button type="button" className="primary" title="Enter" onClick={onNextImpression}>
          {F.proof.nextImpression}
        </button>
      ) : (
        <button type="button" className="primary" title="Enter" onClick={onRestart}>
          {F.proof.castAnother}
        </button>
      )}
    </aside>
  )
}

export default FoundryPanel
