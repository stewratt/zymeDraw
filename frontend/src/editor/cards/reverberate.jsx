// Reverberate — the stamp used as a brush. Take one image, the sidecar
// cuts its subject out, and every stroke lays the cutout down in repeated
// impressions along the path — the Kid Pix rope. Spacing, opacity, and
// per-impression jitter shape the echo; End bakes the braid down.
//
// The front is Stamp's chain verbatim (grid of 6 → pick → cutout, degraded
// path = the whole image becomes the stamp); the back is the stamp session
// in brushCore.js — a full-canvas overlay at master resolution, left in
// place for the universal bake.

import { BRUSH_SIZE_MAX, BRUSH_SIZE_MIN, createStampSession } from '../brushCore.js'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { CardGridPicker } from '../GridPicker.jsx'
import { sampleImages } from '../sampling.js'
import { fetchCutoutUrl } from './stamp.jsx'

const GRID_SIZE = 6

// A plain decoded bitmap — the session draws it directly, so the cutout
// never becomes a Fabric object.
function loadBitmap(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export async function beginReverberate(ctx) {
  const files = await sampleImages(GRID_SIZE, ctx.imageList)
  const chosen = await new Promise((resolve) => {
    ctx.report({ stage: 'pick', gridFiles: files, pick: resolve })
  })
  ctx.report({ stage: 'cutting', gridFiles: null, pick: null })

  let url = null
  try {
    url = await fetchCutoutUrl(chosen)
  } catch {
    // degrade: the whole image becomes the stamp
  }
  if (ctx.isCancelled?.()) {
    if (url) URL.revokeObjectURL(url)
    return null
  }

  const stampEl = await loadBitmap(url ?? `/api/images/${encodeURIComponent(chosen)}`)
  if (url) URL.revokeObjectURL(url)
  if (ctx.isCancelled?.()) return null

  const controlsRef = { current: ctx.controls }
  const session = createStampSession(ctx.canvas, {
    stampEl,
    master: ctx.master,
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo }),
    onSizeChange: (size) => ctx.setControl('size', size)
  })
  ctx.report({
    stage: 'work',
    degraded: url === null,
    undo: session.undo,
    redo: session.redo,
    canUndo: false,
    canRedo: false
  })
  return { session, controlsRef }
}

export function updateReverberate(ctx) {
  const s = ctx.session
  if (!s) return
  // Settings are per stroke: the next stroke reads the ref when it begins.
  s.controlsRef.current = ctx.controls
}

export function commitReverberate(ctx) {
  // Drop the brush; the overlay stays for the universal bake.
  ctx.session?.session.dispose()
}

export function cleanupReverberate(ctx) {
  if (!ctx.session) return
  ctx.session.session.dispose()
  ctx.session.session.removeOverlay()
}

export function ReverberateOverlay({ info }) {
  if (info.stage !== 'pick' || !info.gridFiles) return null
  return (
    <CardGridPicker
      title={UI.cardHints.reverberate.pickTitle}
      hint={UI.cardHints.reverberate.pickHint}
      files={info.gridFiles}
      confirmLabel={UI.cardHints.reverberate.confirm}
      onConfirm={(f) => info.pick?.(f)}
    />
  )
}

export function ReverberateTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'pick') return <span className="hint">{UI.shared.takeOne}</span>
  if (info.stage === 'cutting') {
    return <span className="hint">{UI.cardHints.reverberate.cutting}</span>
  }
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        {info.degraded
          ? UI.cardHints.reverberate.degraded
          : CARD_TEXT.reverberate.description}
      </p>
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
      <label className="ctrl" title="Gap between impressions, as a share of their size">
        <span className="ctrl-label">Spacing</span>
        <input
          type="range"
          min="1"
          max="250"
          value={Math.round(controls.spacing * 100)}
          onChange={(e) => onControlChange('spacing', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.spacing * 100)}%</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Opacity</span>
        <input
          type="range"
          min="5"
          max="100"
          value={Math.round(controls.opacity * 100)}
          onChange={(e) => onControlChange('opacity', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.opacity * 100)}%</span>
      </label>
      <label className="ctrl" title="Wobbles each impression's size and angle">
        <span className="ctrl-label">Jitter</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(controls.jitter * 100)}
          onChange={(e) => onControlChange('jitter', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.jitter * 100)}%</span>
      </label>
      <div className="undo-row">
        <button type="button" className="secondary" title="Cmd/Ctrl+Z" disabled={!info.canUndo} onClick={() => info.undo?.()}>
          Undo
        </button>
        <button type="button" className="secondary" title="Cmd/Ctrl+Shift+Z" disabled={!info.canRedo} onClick={() => info.redo?.()}>
          Redo
        </button>
      </div>
    </div>
  )
}
