// The master raster — the offscreen full-resolution truth.
//
// The visible Fabric canvas is a working proxy at 800×1000. The real pixels
// live here, in a plain 2400×3000 canvas element (the "master"). The master
// sits on the proxy as a background image scaled to 1/3; Fabric keeps the
// original element as the image source, so every bake re-renders the base
// from the true pixels — the committed image never degrades, bake after bake.
//
// Export writes the master directly. No toDataURL multiplier, which also
// retires v1's blank-PNG-on-conservative-GPUs export bug.

import * as fabric from 'fabric'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './CanvasStage.jsx'

export const MASTER_SCALE = 3
export const MASTER_WIDTH = CANVAS_WIDTH * MASTER_SCALE // 2400
export const MASTER_HEIGHT = CANVAS_HEIGHT * MASTER_SCALE // 3000

// A fresh, white master. Dimensions default to Deck's 2400×3000; Foundry
// passes its own (2235×3120 — the card face at the same 3× scale). Every
// other function here is already dimension-agnostic: showMaster reads the
// master element's own size, and bake scales by MASTER_SCALE, which is the
// shared proxy→master ratio in both apps.
export function createMaster(width = MASTER_WIDTH, height = MASTER_HEIGHT) {
  const el = document.createElement('canvas')
  el.width = width
  el.height = height
  const ctx = el.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  return el
}

// Show the master on the working canvas as the ARTBOARD: a fixed rectangle
// seated at scene origin (0,0) with the artboard's footprint.
//
// Since the pasteboard (Phase 1) the Fabric buffer is the whole workspace, so
// we must NOT scale the master to the buffer (canvas.getWidth/getHeight) — that
// would stretch the artboard across the void. The master is always MASTER_SCALE×
// the artboard (createMaster sizes it that way and bake re-renders at that
// scale), so 1/MASTER_SCALE seats it back at one artboard-unit per scene pixel:
// 800×1000 for Deck, 745×1040 for Foundry, with no per-app branch. The camera
// (canvasNav) is what makes the artboard roam or fill the view; showMaster only
// ever places it at the origin.
//
// The float treatment (transparent buffer + paper shadow) is pasteboard-only,
// gated on `canvas.__pasteboard` (set by CanvasStage in `fill` mode). Deck gets
// the void showing around the artboard and a soft shadow lifting the "paper";
// the shadow falls only on the void — the opaque master covers it within the
// artboard rect, and Phase 4's bake crop (0,0 → artboard) excludes the spill,
// so it never bakes in. Foundry (no `fill`) keeps its opaque buffer with no
// shadow: its master tiles the whole buffer, so there is no void to reveal and
// a card face must not carry a drop shadow. Fabric 6 has no setBackgroundImage
// — assign the property directly.
export function showMaster(canvas, master) {
  const scale = 1 / MASTER_SCALE
  const floating = !!canvas.__pasteboard
  if (floating) canvas.backgroundColor = '' // transparent buffer → CSS void shows through
  canvas.backgroundImage = new fabric.FabricImage(master, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: scale,
    scaleY: scale,
    ...(floating
      ? { shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.55)', blur: 24, offsetX: 0, offsetY: 12 }) }
      : {})
  })
  canvas.requestRenderAll()
}

// The universal bake: render everything on the working canvas (the master
// background + the current card's temporary objects) at master resolution.
// The result IS the new master. The card's objects are then cleared and the
// new master becomes the background — cards never implement flattening.
export function bake(canvas) {
  // Drop any live selection so its handles/state never affect the snapshot.
  canvas.discardActiveObject?.()
  // Reset the viewport to identity before snapshotting: toCanvasElement bakes
  // through the current viewportTransform, so a leaked zoom/pan (from the
  // canvasNav lens, or a card that owns the viewport) would shift/scale the
  // committed pixels. This is the single chokepoint every End/commit funnels
  // through — resetting here guarantees the master is baked from the true,
  // unzoomed proxy regardless of what left the view transformed (CLAUDE.md §6).
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  // Flush filter pipelines before snapshotting (CLAUDE.md §9's timing note).
  canvas.renderAll()
  // Crop the snapshot to the artboard rectangle at scene origin. Once the
  // buffer becomes the whole pasteboard (bigger than the artboard), an
  // uncropped snapshot would bake the surrounding void in; the crop takes
  // exactly the artboard. The artboard footprint in proxy coords is the
  // master's native size ÷ MASTER_SCALE (2400/3 = 800 in Deck, 2235/3 = 745
  // in Foundry) — deriving it here keeps bake dimension-agnostic across both
  // apps and needs no artboard dims threaded from the caller. With the
  // viewport reset to identity above, scene coords equal buffer pixels, so
  // {left:0, top:0} is the artboard's top-left. Fall back to the full buffer
  // if no master is shown yet (pre-first-bake safety).
  const src = canvas.backgroundImage
  const cropWidth = src ? src.width / MASTER_SCALE : canvas.getWidth()
  const cropHeight = src ? src.height / MASTER_SCALE : canvas.getHeight()
  const next = canvas.toCanvasElement(MASTER_SCALE, {
    left: 0,
    top: 0,
    width: cropWidth,
    height: cropHeight
  })
  canvas.remove(...canvas.getObjects())
  showMaster(canvas, next)
  return next
}

export function masterToPngDataUrl(master) {
  return master.toDataURL('image/png')
}

export function masterThumbDataUrl(master, width = 320) {
  const el = document.createElement('canvas')
  el.width = width
  el.height = Math.round((width * master.height) / master.width)
  el.getContext('2d').drawImage(master, 0, 0, el.width, el.height)
  return el.toDataURL('image/png')
}
