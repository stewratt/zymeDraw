// The tools sheet — the collapsible strip between the canvas and the deck dock.
//
// It knows nothing about specific cards: in a placement session it renders
// the standing mask brush's shared controls (cards/maskControls.jsx, the same
// block the desktop panel uses), and in a working round it renders whatever
// Tools component the registry entry provides. The desktop's Tools components
// are small stacks of labelled sliders; nothing here rewrites them — the
// mobile stylesheet lays the same markup out for a thumb (mobile.css).
//
// THE GRAB HANDLE (Wave 3): the sheet collapses to its handle and the card's
// name so the piece gets the screen back while you brush, and opens again with
// a tap. It opens itself on every deal — a new card's controls should be in
// front of you, not behind a tap — and remembers nothing beyond that. The
// canvas reflows either way, and the camera re-fits with it (MobileSession
// watches the canvas box, so the whole transition is followed, not just its
// end).
//
// Phases with a full-screen overlay of their own (the opening pick, the stash
// notice, a graft card's grid) have nothing to put here: the decision is the
// whole screen, and this strip stays empty rather than repeating it.

import { useEffect, useState } from 'react'
import { ArrangeMaskControls, maskHint } from '../editor/cards/maskControls.jsx'
import { UI } from '../copy/uiText.js'

const T = UI.deckPanel
const M = UI.mobile

function Sheet({ title, open, onToggle, children }) {
  return (
    <div className={open ? 'm-tools' : 'm-tools m-tools--collapsed'}>
      <button
        type="button"
        className="m-tools-handle"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? M.toolsHide : M.toolsShow}
      >
        <span className="m-tools-grip" aria-hidden="true" />
        <span className="m-tools-title">{title}</span>
      </button>
      <div className="m-tools-body" aria-hidden={!open}>
        {children}
      </div>
    </div>
  )
}

function MobileTools({
  phase,
  entry,
  title,
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
  const [open, setOpen] = useState(true)
  // A new card (or a new phase) arrives with its tools open.
  useEffect(() => {
    setOpen(true)
  }, [phase, entry])

  if (phase === 'PLACEMENT' || phase === 'STASH_RETURN') {
    const brushing = maskControls.mode !== 'arrange'
    return (
      <Sheet title={title} open={open} onToggle={() => setOpen((v) => !v)}>
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
      </Sheet>
    )
  }

  if (phase !== 'WORKING' || !entry) return <div className="m-tools m-tools--empty" />

  const Tools = entry.Tools
  if (!Tools) return <div className="m-tools m-tools--empty" />

  return (
    <Sheet title={title} open={open} onToggle={() => setOpen((v) => !v)}>
      <Tools
        controls={controls}
        info={info}
        ready={ready}
        reviewing={false}
        deckView={deckView}
        onDeckAction={onDeckAction}
        onControlChange={onControlChange}
      />
    </Sheet>
  )
}

export default MobileTools
