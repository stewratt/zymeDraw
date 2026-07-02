// Shared machinery for effect-brush cards (Noise / Blur / HSV).
//
// An effect card is: one applyEffect function that draws a FULL-STRENGTH
// effected copy of the master, plus sliders. Everything else — the reveal
// session, undo/redo reporting, control plumbing — is identical, so it
// lives here and each card file stays tiny.
//
// applyEffect(effectedEl, master, controls) is called once at begin and
// again whenever a non-brush control changes (e.g. the HSV sliders). The
// brush controls (size / hardness / intensity) never trigger a recompute:
// intensity is a globalAlpha re-blend inside the reveal session.

import { createRevealSession } from '../brushCore.js'

const BRUSH_KEYS = new Set(['size', 'hardness', 'intensity'])

export function makeEffectCardHooks(applyEffect) {
  function begin(ctx) {
    const effected = document.createElement('canvas')
    effected.width = ctx.master.width
    effected.height = ctx.master.height
    applyEffect(effected, ctx.master, ctx.controls)
    const controlsRef = { current: ctx.controls }
    const session = createRevealSession(ctx.canvas, effected, {
      getControls: () => controlsRef.current,
      getIntensity: () => controlsRef.current.intensity,
      onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo })
    })
    ctx.report({ undo: session.undo, redo: session.redo, canUndo: false, canRedo: false })
    return { session, controlsRef, effected, master: ctx.master, lastControls: ctx.controls }
  }

  function update(ctx) {
    const s = ctx.session
    if (!s) return
    const effectChanged = Object.keys(ctx.controls).some(
      (k) => !BRUSH_KEYS.has(k) && ctx.controls[k] !== s.lastControls[k]
    )
    s.controlsRef.current = ctx.controls
    s.lastControls = ctx.controls
    if (effectChanged) applyEffect(s.effected, s.master, ctx.controls)
    s.session.refresh()
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
// effect sliders above this.
export function BrushControls({ controls, info, onControlChange }) {
  return (
    <>
      <label className="ctrl">
        <span className="ctrl-label">Size</span>
        <input
          type="range"
          min="6"
          max="200"
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
          onClick={() => onControlChange('hardness', 'soft')}
        >
          Soft
        </button>
        <button
          type="button"
          className={controls.hardness === 'hard' ? 'active' : ''}
          onClick={() => onControlChange('hardness', 'hard')}
        >
          Hard
        </button>
      </div>
      <div className="undo-row">
        <button type="button" className="secondary" disabled={!info.canUndo} onClick={() => info.undo?.()}>
          Undo
        </button>
        <button type="button" className="secondary" disabled={!info.canRedo} onClick={() => info.redo?.()}>
          Redo
        </button>
      </div>
    </>
  )
}
