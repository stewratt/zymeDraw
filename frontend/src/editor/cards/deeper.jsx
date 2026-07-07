// Deeper — re-frame the piece. A 4:5 frame appears over the canvas; move,
// scale and rotate it to choose the piece's new framing. End maps that
// region onto the whole canvas — what's outside the frame is gone — and,
// because zooming in means fewer true pixels, the sidecar's Real-ESRGAN
// model restores detail into the enlargement. This is the card the master
// raster was built for.
//
// The frame keeps the canvas's 4:5 shape by construction: it's a
// canvas-proportioned Rect whose side handles are hidden, and the session
// turns on Fabric's uniform scaling so corner drags scale both axes together
// — the opposite corner stays pinned and the frame can only shrink/grow, not
// squash into a different ratio. (The canvas is created with
// uniformScaling:false, which placement images want, so we flip it on for
// this card and restore it on commit/cleanup.) Rotation stays free.
// Orientation stays portrait — a live invariant (CLAUDE.md §8).
//
// Detail restore: the re-framed master is drawn by 2d transform at master
// resolution first (that alone is a correct, if soft, result — and is the
// graceful-degradation path when the sidecar is down). If the zoom factor
// is meaningful, the re-frame is resampled at its TRUE source detail
// (master/zoom, clamped 600–1200 px wide to bound CPU time), sent through
// /api/ml/upscale (fixed x4), and the result is drawn back at master size.

import * as fabric from 'fabric'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { showMaster } from '../masterRaster.js'

export function beginDeeper(ctx) {
  const rect = new fabric.Rect({
    width: ctx.canvasWidth,
    height: ctx.canvasHeight,
    scaleX: 0.7,
    scaleY: 0.7,
    originX: 'center',
    originY: 'center',
    left: ctx.canvasWidth / 2,
    top: ctx.canvasHeight / 2,
    fill: 'rgba(0, 0, 0, 0)',
    stroke: '#ffffff',
    strokeWidth: 1.5,
    strokeDashArray: [6, 4],
    strokeUniform: true
  })
  // Corners only, no side handles.
  rect.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false })
  // Turn on native uniform scaling so corners keep the 4:5 ratio and pin the
  // opposite corner. Also disable the uniScaleKey so Shift can't opt out of
  // it. Both are restored when the card ends.
  const prev = { uniformScaling: ctx.canvas.uniformScaling, uniScaleKey: ctx.canvas.uniScaleKey }
  ctx.canvas.uniformScaling = true
  ctx.canvas.uniScaleKey = null
  ctx.canvas.add(rect)
  ctx.canvas.setActiveObject(rect)
  ctx.canvas.requestRenderAll()
  return { rect, master: ctx.master, prev }
}

function restoreScaling(canvas, prev) {
  if (!prev) return
  canvas.uniformScaling = prev.uniformScaling
  canvas.uniScaleKey = prev.uniScaleKey
}

export async function commitDeeper(ctx) {
  const s = ctx.session
  if (!s) return
  const { rect, master } = s
  ctx.canvas.discardActiveObject()
  ctx.canvas.remove(rect)
  restoreScaling(ctx.canvas, s.prev)
  ctx.canvas.requestRenderAll()

  const proxyScale = master.width / ctx.canvas.getWidth() // display px → master px
  const zoom = master.width / (rect.getScaledWidth() * proxyScale)

  // Map the frame region onto the full master: center it, undo its
  // rotation, blow it up to full size.
  const reframed = document.createElement('canvas')
  reframed.width = master.width
  reframed.height = master.height
  const g = reframed.getContext('2d')
  g.imageSmoothingQuality = 'high'
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, reframed.width, reframed.height)
  g.translate(reframed.width / 2, reframed.height / 2)
  g.scale(zoom, zoom)
  g.rotate((-rect.angle * Math.PI) / 180)
  g.translate(-rect.left * proxyScale, -rect.top * proxyScale)
  g.drawImage(master, 0, 0)

  let next = reframed
  if (zoom > 1.05) {
    try {
      next = await restoreDetail(reframed, zoom)
    } catch {
      // sidecar down or upscale failed: the plain resample stands
    }
  }
  showMaster(ctx.canvas, next)
}

export function cleanupDeeper(ctx) {
  if (!ctx.session) return
  ctx.canvas.remove(ctx.session.rect)
  restoreScaling(ctx.canvas, ctx.session.prev)
  ctx.canvas.requestRenderAll()
}

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

export function DeeperTools({ ready }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="card-tools">
      <p className="hint">
        {CARD_TEXT.deeper.description} {UI.cardHints.deeper.commitNote}
      </p>
    </div>
  )
}
