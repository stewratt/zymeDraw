// Stamp — a cutout. A grid of 6 is dealt; take one and the sidecar's
// rembg model cuts its subject out of the background; the cutout is
// placed for arranging (move/scale/rotate), opacity, and the standing
// erase brush. End bakes it down.
//
// Graceful degradation (mandatory, CLAUDE.md §3): if the sidecar is down
// or the cutout fails, the WHOLE image is placed instead and the erase
// brush becomes the scissors — the session never blocks on ML. The panel
// says which mode you're in.
//
// Same chain shape as Ghost: begin() deals the grid, awaits the pick,
// then does the (possibly slow) cutout — reported as its own stage so the
// panel can explain the wait while End stays disabled.

import * as fabric from 'fabric'
import { createEraseSession } from '../brushCore.js'
import { CardGridPicker } from '../GridPicker.jsx'
import { sampleImages } from '../sampling.js'
import { ArrangeEraseControls } from './arrangeEraseControls.jsx'

const GRID_SIZE = 6

// The chosen image's bytes → the sidecar → PNG-with-alpha object URL.
// Any failure throws; the caller falls back to the original image.
async function fetchCutoutUrl(filename) {
  const health = await fetch('/api/ml/health').then((r) => r.json())
  if (!health.ok) throw new Error('sidecar down')
  const src = await fetch(`/api/images/${encodeURIComponent(filename)}`)
  if (!src.ok) throw new Error('image fetch failed')
  const blob = await src.blob()
  const r = await fetch('/api/ml/cutout', {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob
  })
  if (!r.ok) throw new Error('cutout failed')
  return URL.createObjectURL(await r.blob())
}

export async function beginStamp(ctx) {
  const files = await sampleImages(GRID_SIZE, ctx.imageList)
  const chosen = await new Promise((resolve) => {
    ctx.report({ stage: 'pick', gridFiles: files, pick: resolve })
  })
  ctx.report({ stage: 'cutting', gridFiles: null, pick: null })

  let url = null
  try {
    url = await fetchCutoutUrl(chosen)
  } catch {
    // degrade: place the full image, erase brush becomes the scissors
  }
  if (ctx.isCancelled?.()) {
    if (url) URL.revokeObjectURL(url)
    return null
  }

  const img = await fabric.FabricImage.fromURL(
    url ?? `/api/images/${encodeURIComponent(chosen)}`
  )
  if (url) URL.revokeObjectURL(url)
  if (ctx.isCancelled?.()) return null

  // Start small — a stamp on the canvas, not a whole new image. Scale to
  // fit 65% of the canvas, then take half of that; resize up as needed.
  const scale =
    Math.min(
      (ctx.canvasWidth * 0.65) / img.width,
      (ctx.canvasHeight * 0.65) / img.height
    ) / 2
  img.set({
    originX: 'center',
    originY: 'center',
    left: ctx.canvasWidth / 2,
    top: ctx.canvasHeight / 2,
    scaleX: scale,
    scaleY: scale,
    opacity: ctx.controls.opacity
  })
  ctx.canvas.add(img)
  ctx.canvas.setActiveObject(img)
  ctx.canvas.requestRenderAll()

  const controlsRef = { current: ctx.controls }
  const session = createEraseSession(ctx.canvas, [img], {
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo })
  })
  ctx.report({
    stage: 'work',
    degraded: url === null,
    undo: session.undo,
    redo: session.redo,
    canUndo: false,
    canRedo: false
  })
  return { img, session, controlsRef }
}

export function updateStamp(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.img.set({ opacity: ctx.controls.opacity })
  s.session.setActive(ctx.controls.mode === 'erase')
  ctx.canvas.requestRenderAll()
}

export function commitStamp(ctx) {
  // Drop the brush; the cutout stays for the universal bake.
  ctx.session?.session.dispose()
}

export function cleanupStamp(ctx) {
  const s = ctx.session
  if (!s) return
  s.session.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

export function StampOverlay({ info }) {
  if (info.stage !== 'pick' || !info.gridFiles) return null
  return (
    <CardGridPicker
      title="STAMP"
      hint="Six images. Take one — its subject is cut out and stamped onto the piece."
      files={info.gridFiles}
      confirmLabel="Continue — cut it out"
      onConfirm={(f) => info.pick?.(f)}
    />
  )
}

export function StampTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'pick') return <span className="hint">Take one image from the grid.</span>
  if (info.stage === 'cutting') {
    return (
      <span className="hint">
        Cutting out the subject… on a machine&apos;s first cutout this downloads the
        model and can take a minute.
      </span>
    )
  }
  if (!ready) return <span className="hint">Preparing…</span>
  const erasing = controls.mode === 'erase'
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        {info.degraded
          ? 'The cutout service is unavailable, so the whole image was placed — the erase brush is your scissors.'
          : erasing
            ? 'Paint over the stamp to erase it.'
            : 'Drag, scale, rotate the stamp into place.'}
      </p>
      <ArrangeEraseControls controls={controls} info={info} onControlChange={onControlChange} />
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
    </div>
  )
}
