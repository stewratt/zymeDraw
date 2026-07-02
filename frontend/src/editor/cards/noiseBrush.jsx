// Noise Brush — the first effect card, and the proof of the reveal
// pipeline: a full-strength grainy copy of the master sits over the canvas,
// fully masked out, and painting reveals it. Influence scales the whole
// reveal. On End the universal bake flattens the composite.
//
// Lifecycle:
//   begin    builds the grainy copy at master resolution, creates the
//            reveal session (brush active immediately), reports undo/redo
//            up to the Tools panel via ctx.report.
//   update   pushes fresh controls into the session; intensity changes are
//            a cheap re-blend, never a recompute.
//   commit   disposes the brush; the overlay stays for the universal bake.
//   cleanup  (restart) disposes the brush AND removes the overlay.

import { createRevealSession } from '../brushCore.js'

// Monochrome grain at full strength, added to a copy of the master.
// ±STRENGTH per pixel, same offset for R/G/B so the grain reads as film,
// not confetti. The Influence slider blends this down from full.
const STRENGTH = 90

function makeGrainyCopy(master) {
  const el = document.createElement('canvas')
  el.width = master.width
  el.height = master.height
  const ctx = el.getContext('2d')
  ctx.drawImage(master, 0, 0)
  const imageData = ctx.getImageData(0, 0, el.width, el.height)
  const px = imageData.data
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * STRENGTH
    px[i] += n
    px[i + 1] += n
    px[i + 2] += n
  }
  ctx.putImageData(imageData, 0, 0)
  return el
}

export function beginNoise(ctx) {
  const effected = makeGrainyCopy(ctx.master)
  const controlsRef = { current: ctx.controls }
  const session = createRevealSession(ctx.canvas, effected, {
    getControls: () => controlsRef.current,
    getIntensity: () => controlsRef.current.intensity,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo })
  })
  // Hand undo/redo up to the Tools panel (and the keyboard shortcut).
  ctx.report({ undo: session.undo, redo: session.redo, canUndo: false, canRedo: false })
  return { session, controlsRef }
}

export function updateNoise(ctx) {
  if (!ctx.session) return
  ctx.session.controlsRef.current = ctx.controls
  ctx.session.session.refresh()
}

export function commitNoise(ctx) {
  ctx.session?.session.dispose()
}

export function cleanupNoise(ctx) {
  if (!ctx.session) return
  ctx.session.session.dispose()
  ctx.session.session.removeOverlay()
}

export function NoiseTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing the grain…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">Paint where the grain belongs. Nothing changes until you paint.</p>
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
    </div>
  )
}
