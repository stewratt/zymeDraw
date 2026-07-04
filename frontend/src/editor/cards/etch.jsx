// Subliminal Etch — a mark almost too small to find (replaced Pore,
// 2026-07-04; the two-word name is Stew's deliberate exception to the
// one-word zyme register).
// A small fixed-size frame is dragged anywhere on the piece; confirming it
// zooms the view all the way into that region — one master pixel is a fat
// square on screen — and a solid-color pixel brush etches a tiny glyph,
// essentially pixel art. End recedes to the whole piece, where the etch is
// barely perceptible. The whole zoom lives inside this one card's session,
// so nothing else in the deck has to know about it.
//
// Geometry: the glyph canvas is GLYPH_W×GLYPH_H *master* pixels (4:5, like
// everything), aligned to the master's pixel grid so the universal bake
// lands it 1:1 with zero resampling. The Fabric image wrapping it renders
// with imageSmoothing off (and caching off — it's tiny) so the on-screen
// squares stay crisp at 25× zoom; the master background gets the same
// treatment while zoomed so you're etching against the piece's true grain.

import * as fabric from 'fabric'
import { MASTER_SCALE, MASTER_WIDTH, MASTER_HEIGHT } from '../masterRaster.js'

const GLYPH_W = 96 // master px — display 32, zoom ≈ 25×
const GLYPH_H = 120
const UNDO_CAP = 50

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// The placement frame: a white-under-black dashed pair so it reads on any
// ground (it's far too small for a plain white stroke to survive).
function makeFrame(canvasWidth, canvasHeight) {
  const dims = {
    width: GLYPH_W / MASTER_SCALE,
    height: GLYPH_H / MASTER_SCALE,
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
    fill: 'rgba(0, 0, 0, 0)',
    strokeUniform: true
  }
  const under = new fabric.Rect({ ...dims, stroke: '#ffffff', strokeWidth: 2.5 })
  const over = new fabric.Rect({ ...dims, stroke: '#111111', strokeWidth: 1, strokeDashArray: [3, 3] })
  const frame = new fabric.Group([under, over], {
    originX: 'center',
    originY: 'center',
    left: canvasWidth / 2,
    top: canvasHeight / 2,
    hasControls: false,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
    padding: 14, // fat hit area — the frame itself is ~32px
    hoverCursor: 'move'
  })
  return frame
}

export async function beginEtch(ctx) {
  const canvas = ctx.canvas
  const frame = makeFrame(ctx.canvasWidth, ctx.canvasHeight)
  const halfW = frame.width / 2
  const halfH = frame.height / 2
  const keepInside = () => {
    frame.set({
      left: clamp(frame.left, halfW, ctx.canvasWidth - halfW),
      top: clamp(frame.top, halfH, ctx.canvasHeight - halfH)
    })
  }
  frame.on('moving', keepInside)
  canvas.add(frame)
  canvas.setActiveObject(frame)
  canvas.requestRenderAll()

  // Await the placement (like Ghost's pick): End stays disabled until the
  // user zooms in. On a restart mid-wait the promise never resolves and
  // Editor's canvas.clear() sweeps the frame.
  await new Promise((resolve) => ctx.report({ stage: 'frame', confirm: resolve }))
  if (ctx.isCancelled?.()) return null

  // Snap the chosen region to the master pixel grid so the bake is 1:1.
  const mLeft = clamp(Math.round(frame.left * MASTER_SCALE - GLYPH_W / 2), 0, MASTER_WIDTH - GLYPH_W)
  const mTop = clamp(Math.round(frame.top * MASTER_SCALE - GLYPH_H / 2), 0, MASTER_HEIGHT - GLYPH_H)
  const region = { left: mLeft / MASTER_SCALE, top: mTop / MASTER_SCALE }
  canvas.discardActiveObject()
  canvas.remove(frame)

  // The glyph: a transparent master-resolution canvas laid exactly over the
  // region. All etching is fillRects on this element; the piece's own
  // pixels are never touched until the universal bake.
  const glyph = document.createElement('canvas')
  glyph.width = GLYPH_W
  glyph.height = GLYPH_H
  const g = glyph.getContext('2d')
  const img = new fabric.FabricImage(glyph, {
    left: region.left,
    top: region.top,
    originX: 'left',
    originY: 'top',
    scaleX: 1 / MASTER_SCALE,
    scaleY: 1 / MASTER_SCALE,
    selectable: false,
    evented: false,
    imageSmoothing: false,
    objectCaching: false
  })
  canvas.add(img)

  // Dive in. The card owns the viewport for its whole session; commit and
  // cleanup both restore it.
  const z = ctx.canvasWidth / (GLYPH_W / MASTER_SCALE)
  canvas.setViewportTransform([z, 0, 0, z, -region.left * z, -region.top * z])

  const bg = canvas.backgroundImage
  const prev = {
    selection: canvas.selection,
    skipTargetFind: canvas.skipTargetFind,
    defaultCursor: canvas.defaultCursor,
    bgSmoothing: bg?.imageSmoothing
  }
  canvas.selection = false
  canvas.skipTargetFind = true
  canvas.defaultCursor = 'crosshair'
  if (bg) bg.imageSmoothing = false

  const controlsRef = { current: ctx.controls }
  const undoStack = []
  const redoStack = []
  const snapshot = () => g.getImageData(0, 0, GLYPH_W, GLYPH_H)
  const reportHistory = () =>
    ctx.report({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 })

  const stamp = (x, y) => {
    const size = Math.max(1, Math.round(controlsRef.current.pixel ?? 1))
    g.fillStyle = controlsRef.current.color
    g.fillRect(x - (size >> 1), y - (size >> 1), size, size)
  }
  const toPixel = (e) => {
    const p = canvas.getScenePoint(e.e)
    return {
      x: Math.floor((p.x - region.left) * MASTER_SCALE),
      y: Math.floor((p.y - region.top) * MASTER_SCALE)
    }
  }

  let drawing = false
  let last = null
  const onDown = (e) => {
    undoStack.push(snapshot())
    if (undoStack.length > UNDO_CAP) undoStack.shift()
    redoStack.length = 0
    drawing = true
    last = toPixel(e)
    stamp(last.x, last.y)
    reportHistory()
    canvas.requestRenderAll()
  }
  const onMove = (e) => {
    if (!drawing) return
    const pt = toPixel(e)
    // Walk pixel-by-pixel between events so fast strokes don't gap.
    const steps = Math.max(Math.abs(pt.x - last.x), Math.abs(pt.y - last.y), 1)
    for (let i = 1; i <= steps; i++) {
      stamp(
        Math.round(last.x + ((pt.x - last.x) * i) / steps),
        Math.round(last.y + ((pt.y - last.y) * i) / steps)
      )
    }
    last = pt
    canvas.requestRenderAll()
  }
  const onUp = () => {
    drawing = false
  }
  canvas.on('mouse:down', onDown)
  canvas.on('mouse:move', onMove)
  canvas.on('mouse:up', onUp)

  const undo = () => {
    if (undoStack.length === 0) return
    redoStack.push(snapshot())
    g.putImageData(undoStack.pop(), 0, 0)
    reportHistory()
    canvas.requestRenderAll()
  }
  const redo = () => {
    if (redoStack.length === 0) return
    undoStack.push(snapshot())
    g.putImageData(redoStack.pop(), 0, 0)
    reportHistory()
    canvas.requestRenderAll()
  }

  ctx.report({ stage: 'draw', confirm: null, undo, redo, canUndo: false, canRedo: false })
  return {
    img,
    controlsRef,
    teardown: () => {
      canvas.off('mouse:down', onDown)
      canvas.off('mouse:move', onMove)
      canvas.off('mouse:up', onUp)
      canvas.selection = prev.selection
      canvas.skipTargetFind = prev.skipTargetFind
      canvas.defaultCursor = prev.defaultCursor
      if (bg && prev.bgSmoothing !== undefined) bg.imageSmoothing = prev.bgSmoothing
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
      canvas.requestRenderAll()
    }
  }
}

export function updateEtch(ctx) {
  if (!ctx.session) return
  ctx.session.controlsRef.current = ctx.controls
}

export function commitEtch(ctx) {
  // Recede to the whole piece; the glyph image stays for the universal
  // bake, which lands it 1:1 on the master grid.
  ctx.session?.teardown()
}

export function cleanupEtch(ctx) {
  const s = ctx.session
  if (!s) return // still at the frame stage — Editor's restart sweeps it
  s.teardown()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

export function EtchTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'frame') {
    return (
      <div className="card-tools">
        <p className="hint">
          Drag the small frame to where the mark should hide. Its size is
          fixed — about a hundred pixels of the piece.
        </p>
        <button type="button" className="primary" onClick={() => info.confirm?.()}>
          Zoom in
        </button>
      </div>
    )
  }
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        You are at the grain — every square is one pixel of the piece. Etch a
        small glyph. At full size it will be almost nothing.
      </p>
      <label className="ctrl">
        <span className="ctrl-label">Color</span>
        <input
          type="color"
          value={controls.color}
          onChange={(e) => onControlChange('color', e.target.value)}
        />
        <span className="ctrl-value mono">{controls.color}</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Pixel</span>
        <input
          type="range"
          min="1"
          max="4"
          value={controls.pixel}
          onChange={(e) => onControlChange('pixel', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.pixel}px</span>
      </label>
      <div className="undo-row">
        <button type="button" className="secondary" disabled={!info.canUndo} onClick={() => info.undo?.()}>
          Undo
        </button>
        <button type="button" className="secondary" disabled={!info.canRedo} onClick={() => info.redo?.()}>
          Redo
        </button>
      </div>
    </div>
  )
}
