// The smieer session — the classic smudge brush, on the whole piece.
//
// A fourth consumer of brushCore's stroke engine, living outside brushCore
// because that file already carries three built-ins and its header names
// this exact escape hatch (createStrokeEngine is exported for card-owned
// composites). Structurally this is the stamp session's twin: one full-canvas
// Fabric image at master resolution, left in place for the universal bake.
//
// WHAT MAKES SMIEER DIFFERENT from every other brush here: it reads its own
// output. The mask and reveal sessions are order-agnostic — a stroke's result
// depends only on its own settings — so they can composite a stroke's pixels
// at any time. A smieer dab drags whatever the PREVIOUS dab just left behind,
// so dabs must run in sequence, into a single `working` canvas that starts as
// a copy of the master and is deformed in place. Everywhere the hand hasn't
// been, `working` is pixel-identical to the master, so the bake is seamless.
//
// THE ALGORITHM is the standard pickup buffer (Photoshop's smudge, GIMP's
// smudge): the brush carries paint, and canvas and brush swap paint as the
// stroke moves. Per dab, at the dab's own footprint:
//
//   1. LEAK   pickup = canvas·(1−retain) + pickup·retain   — one drawImage
//             at globalAlpha = 1 − retain. This IS the smudge: retain 1 means
//             the brush never refreshes (colour drags forever), retain 0 means
//             it always holds exactly what's under it (nothing moves).
//   2. SHAPE  the pickup through the soft dab mask (destination-in).
//   3. STAMP  that back into `working` at the dab's position, at FLOW — a
//             fraction, never the whole dab.
//
// THAT FRACTION IS WHAT MAKES IT A SMUDGE AND NOT A ROW OF STAMPS. A dab
// deposited at full strength replaces the canvas outright wherever its mask
// core sits, so every dab centre is a hard reset and the gaps between centres
// only get the soft skirt — the stroke comes out banded at exactly the dab
// interval (the first build did this; the stripes were unmistakable). Laying
// each dab down at a fraction instead lets ~30 overlapping dabs accumulate
// into a full smudge with no periodic signature. Both FLOW and `retain` are
// therefore quoted PER RADIUS TRAVELLED and converted to per-dab figures
// here, so spacing is free to change without altering how the brush behaves.
//
// Three drawImages on DAB-SIZED canvases — cost rides brush area, not canvas
// area, which is what makes master-resolution work affordable here. (The
// tempting shortcut — fractureField's getImageData over the whole master —
// would be ~100× the work per dab.)
//
// `strength` is measured PER RADIUS TRAVELLED, not per dab: retain is
// strength^(step/radius). Spacing then only buys smoothness — it can be tuned
// freely without changing how far colour actually drags.
//
// Edge behaviour is the browser's: when a dab's footprint hangs off the
// canvas, drawImage clips source and destination in the same proportion, so
// the in-bounds part of the pickup stays aligned in both directions and the
// out-of-bounds part is simply never read or written.

import * as fabric from 'fabric'
import { createStrokeEngine, drawDab, makeLayer, mulberry32 } from './brushCore.js'
import { MASTER_SCALE } from './masterRaster.js'

// Dab spacing as a fraction of the brush radius. Far tighter than the mask
// engine's 0.35 — a smudge reads as a drag only if the dabs pile up. Not
// tighter still, deliberately: every step this shrinks also shrinks the
// per-dab leak alpha, and canvas compositing is 8-bit, so below roughly 0.05
// the pickup stops updating at all across gentle gradients (the rounding
// eats the change) and colour would drag further than Strength promises.
const SPACING = 0.08

// How much of the piece a dab's core has replaced after the brush travels one
// radius. Just under 1: the smudge must be able to reach full strength, but
// arrive there over many dabs rather than in one.
const COVER = 0.97

// Per-dab wobble, as a fraction of the radius. Small on purpose: enough to
// keep the dab centres off a perfect lattice (any leftover regularity reads
// as machine-made), not enough to fray the stroke.
const JITTER = 0.06

const strokeRadius = (stroke) => Math.max(stroke.radiusX, stroke.radiusY)

// Arc length between dabs. Clamped at 1px so a tiny brush can't ask for
// sub-pixel spacing; `retain` reads this back, so strength stays honest there.
function dabInterval(stroke) {
  return Math.max(1, strokeRadius(stroke) * SPACING)
}

// Walk the stroke's polyline and place one dab per arc-length interval, in
// working-canvas pixels, each nudged off the lattice by a seeded wobble. A
// pure function of the stroke record — the seed rides in its settings, so the
// live pass and undo's replay lay the identical dabs. And because points are
// only ever appended and the wobble is drawn in landing order from a fresh
// stream each call, the prefix of this list never changes mid-stroke: that is
// what lets the live pass apply only the tail.
function dabsFor(stroke) {
  const interval = dabInterval(stroke)
  const wobble = strokeRadius(stroke) * JITTER
  const rand = mulberry32(stroke.settings.seed)
  const out = []
  let need = 0
  let walked = 0
  for (let i = 0; i < stroke.points.length; i++) {
    const from = stroke.points[Math.max(0, i - 1)]
    const to = stroke.points[i]
    const seg = Math.hypot(to.x - from.x, to.y - from.y)
    while (walked + seg >= need) {
      const t = seg === 0 ? 0 : (need - walked) / seg
      out.push({
        x: from.x + (to.x - from.x) * t + (rand() * 2 - 1) * wobble,
        y: from.y + (to.y - from.y) * t + (rand() * 2 - 1) * wobble
      })
      need += interval
    }
    walked += seg
  }
  return out
}

export function createSmieerSession(canvas, { master, getControls, onHistoryChange, onSizeChange }) {
  const working = makeLayer(master.width, master.height)
  const strokeMask = makeLayer(master.width, master.height) // engine scratch; dabs never read it

  function resetWorking() {
    const ctx = working.getContext('2d')
    ctx.clearRect(0, 0, working.width, working.height)
    ctx.drawImage(master, 0, 0)
  }
  resetWorking()

  const overlay = new fabric.FabricImage(working, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    // The master's own artboard footprint, derived from MASTER_SCALE — the
    // seating that is correct on Deck's pasteboard and on Foundry's card-face
    // artboard alike (see the reveal/stamp overlays; issues #53, #97).
    scaleX: 1 / MASTER_SCALE,
    scaleY: 1 / MASTER_SCALE,
    selectable: false,
    evented: false
  })
  canvas.add(overlay)

  // The brush in hand: rebuilt per stroke, since size/hardness/softness are
  // fixed for a stroke's whole life. `pickup` is the paint it carries.
  let brush = null

  function loadBrush(stroke) {
    const w = Math.max(1, Math.ceil(stroke.radiusX * 2))
    const h = Math.max(1, Math.ceil(stroke.radiusY * 2))
    const mask = makeLayer(w, h)
    drawDab(mask.getContext('2d'), w / 2, h / 2, w / 2, h / 2, stroke.hardness, stroke.softness)
    // Both rates are quoted per radius travelled; a dab covers `share` of a
    // radius, so each per-dab figure is that root of the whole-radius one.
    const share = dabInterval(stroke) / strokeRadius(stroke)
    brush = {
      stroke,
      w,
      h,
      mask,
      pickup: makeLayer(w, h),
      shaped: makeLayer(w, h),
      charged: false,
      // Strength is capped below 1 so the brush always eventually refreshes —
      // at a true 1 the first colour picked up would drag to the far edge.
      retain: Math.pow(Math.min(0.995, Math.max(0, stroke.settings.strength)), share),
      flow: 1 - Math.pow(1 - COVER, share)
    }
  }

  // One dab: leak, shape, stamp. Positions are rounded so the region copies
  // stay 1:1 — a sub-pixel resample per dab would soften the piece by itself.
  function applyDab(dab) {
    const left = Math.round(dab.x - brush.w / 2)
    const top = Math.round(dab.y - brush.h / 2)
    const pickCtx = brush.pickup.getContext('2d')

    if (!brush.charged) {
      // The brush starts loaded with exactly what's under it, so the first
      // dab stamps back what it took: pressing without moving marks nothing.
      pickCtx.clearRect(0, 0, brush.w, brush.h)
      pickCtx.drawImage(working, left, top, brush.w, brush.h, 0, 0, brush.w, brush.h)
      brush.charged = true
    } else {
      pickCtx.save()
      pickCtx.globalAlpha = 1 - brush.retain
      pickCtx.drawImage(working, left, top, brush.w, brush.h, 0, 0, brush.w, brush.h)
      pickCtx.restore()
    }

    const shapedCtx = brush.shaped.getContext('2d')
    shapedCtx.save()
    shapedCtx.clearRect(0, 0, brush.w, brush.h)
    shapedCtx.drawImage(brush.pickup, 0, 0)
    shapedCtx.globalCompositeOperation = 'destination-in'
    shapedCtx.drawImage(brush.mask, 0, 0)
    shapedCtx.restore()

    const outCtx = working.getContext('2d')
    outCtx.save()
    outCtx.globalAlpha = brush.flow // a share of the dab, never the whole one
    outCtx.drawImage(brush.shaped, left, top)
    outCtx.restore()
  }

  // Apply a stroke's dabs from `from` onward. Reloads the brush whenever the
  // stroke changes — a new stroke, or an undo replay stepping to the next one.
  function applyStroke(stroke, from) {
    if (brush?.stroke !== stroke) loadBrush(stroke)
    const dabs = dabsFor(stroke)
    for (let i = from; i < dabs.length; i++) applyDab(dabs[i])
    return dabs.length
  }

  let live = null // { stroke, drawn } — dabs of the in-progress stroke already applied

  const state = {
    strokeMask,
    strokes: [],
    bakeStroke(stroke) {
      // Two callers: the engine at release, and its rebuild() replaying
      // history. At release the stroke is already on `working` dab by dab —
      // finish any tail the last pointer event didn't cover and stop. A
      // replay (a stroke we have no live record of) runs from dab 0.
      if (live?.stroke === stroke) {
        applyStroke(stroke, live.drawn)
        live = null
        return
      }
      applyStroke(stroke, 0)
    },
    clearCommitted() {
      // Undo/redo replay starts from the untouched piece.
      resetWorking()
      live = null
      brush = null
    },
    recomposite(liveStroke) {
      if (liveStroke) {
        if (live?.stroke !== liveStroke) live = { stroke: liveStroke, drawn: 0 }
        live.drawn = applyStroke(liveStroke, live.drawn)
      }
      overlay.dirty = true
      canvas.requestRenderAll()
    }
  }

  const engine = createStrokeEngine(canvas, {
    states: new Map([[overlay, state]]),
    // The overlay covers the whole piece; every stroke belongs to it.
    resolveTarget: () => overlay,
    getControls,
    // The seed rides in the record so undo's replay wobbles exactly as the
    // stroke the hand saw — the same reason the stamp session snapshots one.
    snapshotSettings: (c) => ({
      strength: c.strength ?? 0.6,
      seed: Math.floor(Math.random() * 4294967296)
    }),
    onHistoryChange,
    onSizeChange
  })
  engine.setActive(true)

  return {
    ...engine,
    overlay,
    // Restart abandons the card: take the overlay with us.
    removeOverlay() {
      canvas.remove(overlay)
      canvas.requestRenderAll()
    }
  }
}
