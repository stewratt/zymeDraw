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

function FoundryPanel({
  state,
  entry,
  controls,
  info,
  ready,
  committing,
  plateReady,
  artReady,
  maskControls,
  maskHistory,
  onMaskControlsChange,
  onMaskUndo,
  onMaskRedo,
  onRepick,
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
          <h2>THE COMMISSION</h2>
          <p className="hint">
            A cast is one session for one face. Pick the card from the grid —
            its name and type line will follow it onto the plate.
          </p>
        </aside>
      )

    case 'PLATE_DEAL':
      return (
        <aside className="deck-panel">
          <h2>THE PLATE</h2>
          <p className="hint">
            Casting <strong>{state.commission.label}</strong>. Take one of the
            dealt plates from the table.
          </p>
        </aside>
      )

    case 'PANEL_PICK': {
      const hasArt = !!state.panelArt
      const brushing = maskControls.mode !== 'arrange'
      const canContinue = plateReady && artReady
      return (
        <aside className="deck-panel">
          <div className="panel-scroll">
            <h2>THE PANEL</h2>
            {!hasArt ? (
              <p className="hint">
                Take an image from the grid. Or continue with the window
                empty — the white shows, and the graffiti decides what it
                becomes.
              </p>
            ) : (
              <>
                <p className="hint">
                  Arrange the art under the window — the plate&apos;s edge
                  crops whatever crosses it.{' '}
                  {brushing
                    ? maskHint(maskControls.mode, 'the art')
                    : 'Drag to move, corner handles to scale, top handle to rotate.'}{' '}
                  Everything stays live until the Press.
                </p>
                <div className="brush-tools">
                  <ArrangeMaskControls
                    controls={maskControls}
                    info={{ ...maskHistory, undo: onMaskUndo, redo: onMaskRedo }}
                    onControlChange={(key, value) => onMaskControlsChange({ [key]: value })}
                  />
                </div>
                <button type="button" className="secondary" onClick={onRepick}>
                  Put it back — re-pick
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="primary"
            title={hasArt ? 'Enter' : undefined}
            disabled={!canContinue}
            onClick={onEndPanel}
          >
            {!plateReady
              ? 'Mounting the plate…'
              : !artReady
                ? 'Placing the art…'
                : hasArt
                  ? 'Continue — to the type'
                  : 'Continue — window empty'}
          </button>
        </aside>
      )
    }

    case 'TYPE_SETTING':
      return (
        <aside className="deck-panel">
          <div className="panel-scroll">
            <h2>THE TYPE</h2>
            <p className="hint">
              Name, type line, description, and the rarity mark set here.
              (Stub — the type layer arrives in Phase 4.) The art is still
              live underneath — arrow keys nudge, comma/period rotate,
              minus/equals scale.
            </p>
            <p className="hint">
              The Press seals the whole foundation — art, plate, and type
              flatten to pixels for good. After it, the graffiti deck works
              the sealed face.
            </p>
          </div>
          <button type="button" className="primary" disabled={!plateReady} onClick={onPress}>
            Press — seal the foundation
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
            <h2>THE WORKING DECK</h2>
            <p className="hint">
              {state.deck.length} card{state.deck.length === 1 ? '' : 's'} remain
            </p>
            <p className="hint">{foundryProgressLabel(state)}</p>
          </div>
          <button type="button" className="primary" title="Space" onClick={onDeal}>
            Deal
          </button>
        </aside>
      )

    case 'COMPLETE':
      return (
        <Proofed
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

function RoundPanel({ state, entry, controls, info, ready, committing, onControlChange, onCommit }) {
  const card = state.currentCard
  const ToolsComponent = entry?.Tools
  const commitDisabled = !ready || committing
  return (
    <aside className="deck-panel">
      <div className="panel-scroll">
        <h2>THIS ROUND</h2>
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
            <span className="hint">
              (placeholder — scribble on the face; this card&apos;s real tool
              arrives in Phase 5)
            </span>
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
        {committing ? 'Committing…' : commitDisabled ? 'Setting up…' : 'End — commit'}
      </button>
    </aside>
  )
}

function Proofed({ state, exportState, onRestart, onOpenOutput }) {
  const status = exportState?.status ?? 'idle'
  return (
    <aside className="deck-panel complete">
      <div className="panel-scroll">
        <h2>THE PROOF</h2>
        <Card id="proof" label="Proof" kind="death" size="panel" flip />
        <p className="card-name">Proof</p>
        <p className="hint">
          The face of <strong>{state.commission.label}</strong> is cast.
        </p>
        {status === 'exporting' && <p className="hint">Writing PNG to your output folder…</p>}
        {status === 'done' && (
          <>
            {exportState.thumbDataUrl && (
              <img src={exportState.thumbDataUrl} className="export-thumb" alt="The cast face" />
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
        Cast another
      </button>
    </aside>
  )
}

export default FoundryPanel
