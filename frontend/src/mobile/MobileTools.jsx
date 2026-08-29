// The tools sheet — the strip between the canvas and the deck dock.
//
// It knows nothing about specific cards: in a placement session it renders
// the standing mask brush's shared controls (cards/maskControls.jsx, the same
// block the desktop panel uses), and in a working round it renders whatever
// Tools component the registry entry provides. The desktop's Tools components
// are small stacks of labelled sliders; nothing here rewrites them — the
// mobile stylesheet lays the same markup out for a thumb (mobile.css).
//
// Phases with a full-screen overlay of their own (the opening pick, the stash
// notice, a graft card's grid) have nothing to put here: the decision is the
// whole screen, and this strip stays empty rather than repeating it.

import { ArrangeMaskControls, maskHint } from '../editor/cards/maskControls.jsx'
import { UI } from '../copy/uiText.js'

const T = UI.deckPanel

function MobileTools({
  phase,
  entry,
  controls,
  info,
  ready,
  deckView,
  onDeckAction,
  onControlChange,
  maskControls,
  maskHistory,
  placementReady,
  onMaskControlsChange,
  onMaskUndo,
  onMaskRedo
}) {
  if (phase === 'PLACEMENT' || phase === 'STASH_RETURN') {
    const brushing = maskControls.mode !== 'arrange'
    return (
      <div className="m-tools">
        <p className="hint">
          {!placementReady
            ? T.loadingImages
            : brushing
              ? maskHint(maskControls.mode, UI.brush.placementSubject)
              : T.arrangeHint}
        </p>
        <div className="brush-tools">
          <ArrangeMaskControls
            controls={maskControls}
            info={{ ...maskHistory, undo: onMaskUndo, redo: onMaskRedo }}
            onControlChange={(key, value) => onMaskControlsChange({ [key]: value })}
          />
        </div>
      </div>
    )
  }

  if (phase !== 'WORKING' || !entry) return <div className="m-tools m-tools--empty" />

  const Tools = entry.Tools
  if (!Tools) return <div className="m-tools m-tools--empty" />

  return (
    <div className="m-tools">
      <Tools
        controls={controls}
        info={info}
        ready={ready}
        reviewing={false}
        deckView={deckView}
        onDeckAction={onDeckAction}
        onControlChange={onControlChange}
      />
    </div>
  )
}

export default MobileTools
