// Wave 0 throwaway spike (to_do/mobile_plan.md §7) — delete when the wave closes.
//
// The canvas rig. It imports the REAL masterRaster (createMaster/showMaster/
// bake) so the timings are the studio's own universal bake and not a lookalike
// — which is also why it drags CanvasStage.jsx and React in transitively. Dead
// weight on a dev-only page; honest numbers are worth it.
//
// One consequence worth naming: masterRaster seats the master at 1/MASTER_SCALE
// and derives the bake crop the same way, so the artboard in SCENE units is
// always master ÷ MASTER_SCALE. At 3× that is the studio's 800×1000 exactly; at
// the mobile 2× master (1600×2000) it is 533⅓×666⅔ scene units. Same 4:5 frame,
// same on-screen result after fit-and-center — only the scene-unit density
// differs, and the master pixel count (the thing under test) is exact.

import * as fabric from 'fabric'
import { createMaster, showMaster, bake, MASTER_SCALE } from '../editor/masterRaster.js'

// A breath of void around the artboard, as canvasNav's fit does. Computed here
// rather than imported: canvasNav is the desktop camera and Wave 3 owns touch.
const FIT_MARGIN = 0.92

export function createStage(canvasEl, wrapEl) {
  const box = wrapEl.getBoundingClientRect()
  const canvas = new fabric.Canvas(canvasEl, {
    width: Math.max(1, Math.round(box.width)),
    height: Math.max(1, Math.round(box.height)),
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
    uniformScaling: false,
    selection: false,
    // The pasteboard's choice, load-bearing on a 3× DPR phone (§4.3).
    enableRetinaScaling: false
  })
  // Tells showMaster to give the artboard the float treatment.
  canvas.__pasteboard = true

  let master = null
  let artboard = { w: 0, h: 0 }

  function fit() {
    if (!artboard.w) return
    const bw = canvas.getWidth()
    const bh = canvas.getHeight()
    const zoom = Math.min(bw / artboard.w, bh / artboard.h) * FIT_MARGIN
    canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      (bw - artboard.w * zoom) / 2,
      (bh - artboard.h * zoom) / 2
    ])
    canvas.requestRenderAll()
  }

  function reset(masterWidth, masterHeight) {
    canvas.remove(...canvas.getObjects())
    master = createMaster(masterWidth, masterHeight)
    artboard = { w: masterWidth / MASTER_SCALE, h: masterHeight / MASTER_SCALE }
    showMaster(canvas, master)
    fit()
  }

  // Place a decoded source at a comfortable size, centred on the artboard, with
  // Fabric's ordinary controls — touch drag and corner handles ARE the test.
  function place(sourceCanvas) {
    const scale = Math.min(
      (artboard.w * 0.6) / sourceCanvas.width,
      (artboard.h * 0.6) / sourceCanvas.height
    )
    const img = new fabric.FabricImage(sourceCanvas, {
      left: artboard.w / 2,
      top: artboard.h / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      // Fat handles: Fabric draws controls in screen pixels, so these are
      // thumb-sized regardless of zoom.
      cornerSize: 28,
      touchCornerSize: 44,
      transparentCorners: false,
      cornerColor: '#16161a',
      cornerStrokeColor: '#ffffff',
      borderColor: '#16161a'
    })
    canvas.add(img)
    canvas.setActiveObject(img)
    canvas.requestRenderAll()
    return img
  }

  // One real bake, timed. bake() resets the viewport to identity by design, so
  // the fit has to be re-applied afterwards exactly as Editor re-fits on End.
  function bakeOnce() {
    const t0 = performance.now()
    master = bake(canvas)
    const ms = performance.now() - t0
    fit()
    return ms
  }

  const observer = new ResizeObserver(() => {
    const { width, height } = wrapEl.getBoundingClientRect()
    if (width < 1 || height < 1) return
    canvas.setDimensions({ width: Math.round(width), height: Math.round(height) })
    fit()
  })
  observer.observe(wrapEl)

  return {
    canvas,
    fit,
    reset,
    place,
    bakeOnce,
    getMaster: () => master,
    getArtboard: () => artboard,
    // Scene units per master pixel is fixed by masterRaster's own contract.
    masterScale: MASTER_SCALE
  }
}
