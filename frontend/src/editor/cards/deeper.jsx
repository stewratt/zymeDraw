// Deeper — re-frame the piece, inward with restoration. The frame session
// and the 2d re-frame live in frameCardFactory.jsx (shared with Closer);
// what's Deeper's own is the detail restore: because zooming in means fewer
// true pixels, the sidecar's Real-ESRGAN model restores detail into the
// enlargement. This is the card the master raster was built for.
//
// Detail restore: the re-framed master is drawn by 2d transform at master
// resolution first (that alone is a correct, if soft, result — and is the
// graceful-degradation path when the sidecar is down). If the zoom factor
// is meaningful, the re-frame is resampled at its TRUE source detail
// (master/zoom, clamped 600–1200 px wide to bound CPU time), sent through
// /api/ml/upscale (fixed x4), and the result is drawn back at master size.

import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { makeFrameCardHooks } from './frameCardFactory.jsx'

const hooks = makeFrameCardHooks({
  restore: (reframed, zoom) => (zoom > 1.05 ? restoreDetail(reframed, zoom) : reframed)
})

export const beginDeeper = hooks.begin
export const commitDeeper = hooks.commit
export const cleanupDeeper = hooks.cleanup

async function restoreDetail(reframed, zoom) {
  const health = await fetch('/api/ml/health').then((r) => r.json())
  if (!health.ok) throw new Error('sidecar down')

  // Resample the re-frame at its true source detail so the x4 model adds
  // detail instead of chewing on interpolated pixels. Clamped to bound
  // CPU time; ≥ master/4 would already reach master size in one pass.
  const inputW = Math.round(Math.min(1200, Math.max(600, reframed.width / zoom)))
  const inputH = Math.round((inputW * reframed.height) / reframed.width)
  const input = document.createElement('canvas')
  input.width = inputW
  input.height = inputH
  const ictx = input.getContext('2d')
  ictx.imageSmoothingQuality = 'high'
  ictx.drawImage(reframed, 0, 0, inputW, inputH)

  const blob = await new Promise((resolve) => input.toBlob(resolve, 'image/png'))
  const r = await fetch('/api/ml/upscale', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: blob
  })
  if (!r.ok) throw new Error('upscale failed')
  const restored = await createImageBitmap(await r.blob())

  const out = document.createElement('canvas')
  out.width = reframed.width
  out.height = reframed.height
  const octx = out.getContext('2d')
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(restored, 0, 0, out.width, out.height)
  restored.close()
  return out
}

// `committed` flips once the Zoom In button has run the re-frame (issue #92) —
// see CloserTools; the pair reads the same.
export function DeeperTools({ ready, committed }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="card-tools">
      <p className="hint">
        {CARD_TEXT.deeper.description}{' '}
        {committed
          ? UI.cardGate.committedNote
          : `${UI.cardHints.deeper.commitNote} ${UI.cardGate.passNote}`}
      </p>
    </div>
  )
}
