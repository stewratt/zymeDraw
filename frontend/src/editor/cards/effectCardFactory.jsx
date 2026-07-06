// Shared machinery for effect-brush cards (Noise / Blur / HSV).
//
// An effect card is: one applyEffect function that draws a FULL-STRENGTH
// effected copy of the master, plus sliders. Everything else — the reveal
// session, undo/redo reporting, control plumbing — is identical, so it
// lives here and each card file stays tiny.
//
// Settings are PER STROKE (brushCore.js): the sliders configure the brush
// in your hand — only the next stroke. The session calls applyEffect per
// unique effect-params combo and caches the copies; painted strokes never
// change.

import { BRUSH_SIZE_MAX, BRUSH_SIZE_MIN, createRevealSession } from '../brushCore.js'

export function makeEffectCardHooks(applyEffect) {
  function begin(ctx) {
    const controlsRef = { current: ctx.controls }
    const session = createRevealSession(ctx.canvas, {
      applyEffect,
      master: ctx.master,
      getControls: () => controlsRef.current,
      onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo }),
      onSizeChange: (size) => ctx.setControl('size', size)
    })
    ctx.report({ undo: session.undo, redo: session.redo, canUndo: false, canRedo: false })
    return { session, controlsRef }
  }

  function update(ctx) {
    const s = ctx.session
    if (!s) return
    // The next stroke reads the ref when it begins; nothing repaints now.
    s.controlsRef.current = ctx.controls
  }

  function commit(ctx) {
    // Just drop the brush; the overlay stays for the universal bake.
    ctx.session?.session.dispose()
  }

  function cleanup(ctx) {
    // Restart abandons the card: the overlay goes too.
    if (!ctx.session) return
    ctx.session.session.dispose()
    ctx.session.session.removeOverlay()
  }

  return { begin, update, commit, cleanup }
}

// The brush controls every effect card shares. Card Tools render their own
// effect sliders above this. All of it configures the next stroke only.
export function BrushControls({ controls, info, onControlChange }) {
  return (
    <>
      <label className="ctrl" title="[ and ] — or Shift+drag on the canvas">
        <span className="ctrl-label">Size</span>
        <input
          type="range"
          min={BRUSH_SIZE_MIN}
          max={BRUSH_SIZE_MAX}
          value={controls.size}
          onChange={(e) => onControlChange('size', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.size}px</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Influence</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(controls.intensity * 100)}
          onChange={(e) => onControlChange('intensity', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.intensity * 100)}%</span>
      </label>
      <div className="mode-toggle small">
        <button
          type="button"
          className={controls.hardness === 'soft' ? 'active' : ''}
          title="H toggles soft / hard"
          onClick={() => onControlChange('hardness', 'soft')}
        >
          Soft
        </button>
        <button
          type="button"
          className={controls.hardness === 'hard' ? 'active' : ''}
          title="H toggles soft / hard"
          onClick={() => onControlChange('hardness', 'hard')}
        >
          Hard
        </button>
      </div>
      {controls.hardness === 'soft' && (
        <label className="ctrl" title="0% is the plain soft brush; higher is all feather">
          <span className="ctrl-label">Softness</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round((controls.softness ?? 0.5) * 100)}
            onChange={(e) => onControlChange('softness', Number(e.target.value) / 100)}
          />
          <span className="ctrl-value mono">{Math.round((controls.softness ?? 0.5) * 100)}%</span>
        </label>
      )}
      <div className="undo-row">
        <button type="button" className="secondary" title="Cmd/Ctrl+Z" disabled={!info.canUndo} onClick={() => info.undo?.()}>
          Undo
        </button>
        <button type="button" className="secondary" title="Cmd/Ctrl+Shift+Z" disabled={!info.canRedo} onClick={() => info.redo?.()}>
          Redo
        </button>
      </div>
    </>
  )
}
