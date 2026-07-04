// Pore — enclosure (v3 design §7.2), the one structural card. Place a
// small 4:5 frame anywhere on the piece; End commits nothing to the pixels
// — instead the VIEW enters the frame, and the next rounds (TUNING.
// poreRounds in deck.js) are dealt and worked entirely inside it. Effects
// land only within the pore: Editor bakes just that region back into the
// master each End (masterRaster.bakeRegion). After the last enclosed round
// the view recedes and you see what the enclosure did to the whole.
//
// This is a *duration card*: its effect spans the following rounds. The
// countdown lives in deck.js (state.enclosure); the region and the
// viewport zoom are Editor's impure half. Cards dealt inside the pore obey
// the pore — with one rule from the design doc's collision note: a card
// that re-frames the whole piece (Deeper, Rack — `reframes` in the
// registry) ends the enclosure, because the geometry the pore referenced
// is gone. You enclosed it; the dive happened there.
//
// The frame reuses Deeper's interaction (4:5 by construction, corner-scale
// only) minus rotation — the enclosure is a viewport, and viewports don't
// tilt.

import * as fabric from 'fabric'

const MIN_FRACTION = 0.1 // the pore can't shrink below 10% of the canvas

export function beginPore(ctx) {
  const rect = new fabric.Rect({
    width: ctx.canvasWidth,
    height: ctx.canvasHeight,
    scaleX: 0.35,
    scaleY: 0.35,
    originX: 'center',
    originY: 'center',
    left: ctx.canvasWidth / 2,
    top: ctx.canvasHeight / 2,
    fill: 'rgba(0, 0, 0, 0)',
    stroke: '#ffffff',
    strokeWidth: 1.5,
    strokeDashArray: [2, 3],
    strokeUniform: true,
    lockRotation: true
  })
  rect.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false, mtr: false })
  const prev = { uniformScaling: ctx.canvas.uniformScaling, uniScaleKey: ctx.canvas.uniScaleKey }
  ctx.canvas.uniformScaling = true
  ctx.canvas.uniScaleKey = null
  ctx.canvas.add(rect)
  ctx.canvas.setActiveObject(rect)
  ctx.canvas.requestRenderAll()
  return { rect, prev, canvasWidth: ctx.canvasWidth, canvasHeight: ctx.canvasHeight }
}

function restoreScaling(canvas, prev) {
  if (!prev) return
  canvas.uniformScaling = prev.uniformScaling
  canvas.uniScaleKey = prev.uniScaleKey
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Commit returns { enclosureRegion } — the generic registry contract Editor
// watches for. The region is clamped fully inside the canvas so the
// viewport never shows past the piece's edge.
export function commitPore(ctx) {
  const s = ctx.session
  if (!s) return
  const { rect, canvasWidth, canvasHeight } = s
  ctx.canvas.discardActiveObject()
  ctx.canvas.remove(rect)
  restoreScaling(ctx.canvas, s.prev)
  ctx.canvas.requestRenderAll()

  const width = clamp(rect.getScaledWidth(), canvasWidth * MIN_FRACTION, canvasWidth)
  const height = (width * canvasHeight) / canvasWidth // 4:5 by construction
  const left = clamp(rect.left - width / 2, 0, canvasWidth - width)
  const top = clamp(rect.top - height / 2, 0, canvasHeight - height)
  return { enclosureRegion: { left, top, width, height } }
}

export function cleanupPore(ctx) {
  if (!ctx.session) return
  ctx.canvas.remove(ctx.session.rect)
  restoreScaling(ctx.canvas, ctx.session.prev)
  ctx.canvas.requestRenderAll()
}

export function PoreTools({ ready }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="card-tools">
      <p className="hint">
        Place the pore — move it, scale it from the corners. End commits
        nothing yet: the view enters the frame, and the next rounds are worked
        entirely inside it, without perceiving the whole. When the enclosure
        lifts, the view recedes.
      </p>
    </div>
  )
}
