import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as fabric from 'fabric'

// Deck's fixed 8×10 portrait ARTBOARD, at the default working resolution.
// These are the artboard dimensions — "what a card sees" — and all the
// master/export math (masterRaster) derives from them. They are NOT the
// Fabric pixel buffer size once the pasteboard is on: in `fill` mode the
// buffer becomes the whole workspace and the artboard is a rectangle floating
// inside it (see CANVAS_PASTEBOARD_PLAN.md). Foundry passes its own
// card-format dims (745×1040) and does NOT use `fill` — its buffer stays the
// card face, stretched to fit by CSS. Without props nothing changes for it.
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 1000

// The ARTBOARD — "what a card sees," in scene units — aliased to the working
// dims. Before the pasteboard, the Fabric buffer equalled the artboard, so
// code that meant "the artboard" just asked the canvas (`getWidth()`). In
// `fill` mode the buffer is the whole workspace, so those sites (placement,
// lift, brush composites) must read the artboard explicitly. Same numbers;
// the name marks intent — artboard, not buffer.
export const ARTBOARD_WIDTH = CANVAS_WIDTH
export const ARTBOARD_HEIGHT = CANVAS_HEIGHT

// Exposes a small imperative handle: `ref.current.getCanvas()` returns the
// Fabric Canvas instance once it's been created. The parent (Editor) needs
// this so card actions can add/remove/manipulate Fabric objects.
const CanvasStage = forwardRef(function CanvasStage(
  { width = CANVAS_WIDTH, height = CANVAS_HEIGHT, fill = false },
  ref
) {
  const elRef = useRef(null)
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current
  }), [])

  useEffect(() => {
    if (!elRef.current) return
    // `fill` (Deck pasteboard): the buffer IS the workspace — create it at the
    // wrap's current box in CSS pixels, 1:1, so nothing is stretched, and let
    // the ResizeObserver below keep it matched. Otherwise (Foundry): a fixed
    // card-face buffer that CSS scales to fit.
    const box = fill && wrapRef.current
      ? wrapRef.current.getBoundingClientRect()
      : null
    const canvas = new fabric.Canvas(elRef.current, {
      width: box && box.width >= 1 ? Math.round(box.width) : width,
      height: box && box.height >= 1 ? Math.round(box.height) : height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      // Corner handles scale x/y independently (non-uniform) by default.
      // Aspect-ratio lock isn't wanted here; free x/y scaling is the useful one.
      uniformScaling: false,
      // Disable rubber-band group-select. Per-object click/drag still works.
      selection: false,
      // Retina decision (Phase 1 watch-item, CLAUDE.md §6): a full-window
      // buffer at devicePixelRatio 2× would double the buffer AND multiply the
      // 3× bake's texture size, which can hit WebGL caps on conservative GPUs.
      // The pasteboard renders at CSS-pixel resolution; the true pixels live in
      // the 2400×3000 master, so on-screen retina crispness isn't load-bearing.
      // Foundry (fixed small buffer) keeps Fabric's default.
      ...(fill ? { enableRetinaScaling: false } : {})
    })
    // Mark the buffer as a pasteboard so shared modules (masterRaster.showMaster)
    // give it the float treatment — transparent buffer + paper shadow — without
    // threading a flag through every caller. Mirrors the __navPanArmed convention.
    if (fill) canvas.__pasteboard = true
    canvasRef.current = canvas
    return () => {
      canvasRef.current = null
      canvas.dispose()
    }
  }, [fill, width, height])

  // Pasteboard only: track the workspace's size so the buffer always matches
  // its box 1:1 (no stretch/blur). Recreating the canvas on resize would drop
  // every Fabric object, so we resize the live buffer instead.
  useEffect(() => {
    if (!fill || !wrapRef.current) return
    const wrap = wrapRef.current
    const apply = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const { width: w, height: h } = wrap.getBoundingClientRect()
      if (w < 1 || h < 1) return
      canvas.setDimensions({ width: Math.round(w), height: Math.round(h) })
      canvas.requestRenderAll()
    }
    const observer = new ResizeObserver(apply)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [fill])

  return (
    // Foundry keeps the inline aspect-ratio so its on-screen box matches the
    // card buffer's proportions. The pasteboard fills its area instead (see
    // `.canvas-wrap--fill` in editor.css) and needs no aspect lock.
    <div
      ref={wrapRef}
      className={fill ? 'canvas-wrap canvas-wrap--fill' : 'canvas-wrap'}
      style={fill ? undefined : { aspectRatio: `${width} / ${height}` }}
    >
      <canvas ref={elRef} />
    </div>
  )
})

export default CanvasStage
