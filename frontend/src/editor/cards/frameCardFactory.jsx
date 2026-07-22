// Shared machinery for the re-frame pair (Deeper / Closer).
//
// A frame card is: a canvas-proportioned frame you move, scale and rotate
// over the piece; End maps whatever it holds onto the whole canvas — what's
// outside the frame is gone. The session and the 2d re-frame are identical
// between the siblings, so they live here. What varies is what happens to
// the enlarged pixels, and each card passes that in:
//
//   smoothing(zoom) → boolean — whether the re-frame interpolates. Deeper
//     always smooths (the sidecar restores detail anyway); Closer turns it
//     off past a zoom threshold so the grain reads as crisp blocks.
//   restore(reframed, zoom) → canvas — optional async detail pass drawn
//     back at master size. If it throws (sidecar down), the plain re-frame
//     stands: graceful degradation is a requirement, not a fallback.
//
// The frame keeps the canvas's 4:5 shape by construction: it's a
// canvas-proportioned Rect whose side handles are hidden, and the session
// turns on Fabric's uniform scaling so corner drags scale both axes together
// — the opposite corner stays pinned and the frame can only shrink/grow, not
// squash into a different ratio. (The canvas is created with
// uniformScaling:false, which placement images want, so we flip it on for
// this card and restore it on commit/cleanup.) Rotation stays free.
// Orientation stays portrait — a live invariant (CLAUDE.md §6).

import * as fabric from 'fabric'
import { showMaster } from '../masterRaster.js'

export function makeFrameCardHooks({ smoothing = () => true, restore = null } = {}) {
  function begin(ctx) {
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

  async function commit(ctx) {
    const s = ctx.session
    if (!s) return
    const { rect, master } = s
    ctx.canvas.discardActiveObject()
    ctx.canvas.remove(rect)
    restoreScaling(ctx.canvas, s.prev)
    ctx.canvas.requestRenderAll()

    // Scene units → master px. Must divide by the ARTBOARD, not the Fabric
    // buffer: since the pasteboard refactor the buffer is window-sized, and
    // the frame's left/top/scaled size are scene units. Using the buffer made
    // the committed re-frame zoom and land wrong, varying with window size.
    const proxyScale = master.width / ctx.canvasWidth
    const zoom = master.width / (rect.getScaledWidth() * proxyScale)

    // Map the frame region onto the full master: center it, undo its
    // rotation, blow it up to full size.
    const reframed = document.createElement('canvas')
    reframed.width = master.width
    reframed.height = master.height
    const g = reframed.getContext('2d')
    g.imageSmoothingEnabled = smoothing(zoom)
    g.imageSmoothingQuality = 'high'
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, reframed.width, reframed.height)
    g.translate(reframed.width / 2, reframed.height / 2)
    g.scale(zoom, zoom)
    g.rotate((-rect.angle * Math.PI) / 180)
    g.translate(-rect.left * proxyScale, -rect.top * proxyScale)
    g.drawImage(master, 0, 0)

    let next = reframed
    if (restore) {
      try {
        next = await restore(reframed, zoom)
      } catch {
        // sidecar down or upscale failed: the plain resample stands
      }
    }
    showMaster(ctx.canvas, next)
  }

  function cleanup(ctx) {
    if (!ctx.session) return
    ctx.canvas.remove(ctx.session.rect)
    restoreScaling(ctx.canvas, ctx.session.prev)
    ctx.canvas.requestRenderAll()
  }

  return { begin, commit, cleanup }
}

function restoreScaling(canvas, prev) {
  if (!prev) return
  canvas.uniformScaling = prev.uniformScaling
  canvas.uniScaleKey = prev.uniScaleKey
}
