// artboardMatte.js — the crop preview: dim everything outside the artboard.
//
// Since the pasteboard, the Fabric buffer is the whole workspace and nothing
// clips at the artboard edge, so an image scaled past that edge gives no hint
// of where the crop will fall until it's committed. The old hard clip made
// that legible by hiding the overhang; this keeps the overhang visible but
// pushes it down toward the void, so the crop reads live while you move and
// scale (issue #70 — chosen over restoring the clip, which loses the
// pasteboard's whole point: seeing what hangs off the page).
//
// This is a LENS, exactly like canvasNav — it paints on the screen context
// after Fabric has rendered, and touches no object, no master, no bake. Two
// consequences worth stating, because both are load-bearing:
//
//   1. It is NOT a Fabric object. An object would land in canvas.getObjects(),
//      where bake()'s `remove(...getObjects())` and every card that walks the
//      object list would trip over it.
//   2. `after:render` fires for the screen render, for the selection (top)
//      layer, AND for every bake/export snapshot — Fabric 6 cannot tell them
//      apart from the event alone (see its own TODO beside the renderTop fire
//      site). The ctx identity check below is what resolves that, and it is
//      the single reason the matte can never reach the committed pixels.
//
// attachArtboardMatte wires this to a Fabric canvas and returns { dispose }.
// Pasteboard-only, gated on `canvas.__pasteboard` (set by CanvasStage in
// `fill` mode) — the same convention showMaster uses for the float treatment.
// Foundry's buffer IS its card face, so there is no void to matte.

import { ARTBOARD_WIDTH, ARTBOARD_HEIGHT } from './CanvasStage.jsx'

// Tuning numbers — iterate in-browser. The void is already near-black
// (#1b1b1d), so the matte's job is not darkening the void: it is pulling
// overhanging *image* pixels down toward the void until the artboard edge
// reads as the boundary it is.
const MATTE_FILL = 'rgba(18, 18, 20, 0.62)'

// A hairline on the artboard edge itself. The paper shadow already delineates
// the page when nothing overlaps it, but overhanging content covers that
// shadow — precisely when the boundary matters most.
const EDGE_STROKE = 'rgba(255, 255, 255, 0.22)'
const EDGE_WIDTH = 1

export function attachArtboardMatte(canvas) {
  if (!canvas.__pasteboard) return { dispose: () => {} }

  const onAfterRender = ({ ctx }) => {
    // The lower canvas context is the only one that is the screen. Anything
    // else is a snapshot mid-bake, where Fabric has temporarily rewritten
    // viewportTransform/width/height — drawing there would burn a mis-scaled
    // matte into the master. See the header note.
    if (ctx !== canvas.getContext()) return

    // At this point Fabric has restored the context transform, so the viewport
    // is ours to apply by hand. The artboard occupies scene (0,0)→(ARTBOARD),
    // so its top-left maps straight to the translation components.
    const vpt = canvas.viewportTransform
    const zoom = vpt[0]
    const x = vpt[4]
    const y = vpt[5]
    const w = ARTBOARD_WIDTH * zoom
    const h = ARTBOARD_HEIGHT * zoom

    ctx.save()
    // One evenodd fill — buffer rect, then the artboard as a hole — rather than
    // four rects around the artboard: a single composite leaves no seam where
    // adjacent semi-transparent fills would antialias against each other.
    ctx.fillStyle = MATTE_FILL
    ctx.beginPath()
    ctx.rect(0, 0, canvas.getWidth(), canvas.getHeight())
    ctx.rect(x, y, w, h)
    ctx.fill('evenodd')

    ctx.strokeStyle = EDGE_STROKE
    ctx.lineWidth = EDGE_WIDTH
    // Half-pixel offset so a 1px stroke lands on one crisp row, not across two.
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    ctx.restore()
  }

  canvas.on('after:render', onAfterRender)

  return {
    dispose: () => {
      canvas.off('after:render', onAfterRender)
      canvas.requestRenderAll()
    }
  }
}
