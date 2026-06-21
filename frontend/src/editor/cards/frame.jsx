import * as fabric from 'fabric'

// Frame — Phase 5 endgame card.
//
// Inset border / passe-partout. Implemented like vignette: render onto an
// offscreen canvas, load as FabricImage, add as a top overlay. The frame
// is the outer rectangle minus the inner rectangle — drawn by filling
// the whole canvas with the chosen color, then clearing a rectangular
// hole in the middle.

let nextFrameNumber = 1

const DEFAULTS = { thickness: 30, color: '#ffffff' }

export async function beginFrame(ctx) {
  const { canvas, canvasWidth, canvasHeight, controls } = ctx
  const dataUrl = renderFrameDataUrl(
    canvasWidth,
    canvasHeight,
    controls.thickness ?? DEFAULTS.thickness,
    controls.color ?? DEFAULTS.color
  )
  const overlay = await fabric.FabricImage.fromURL(dataUrl)
  overlay.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false
  })
  overlay.__framePreview = true
  canvas.add(overlay)
  canvas.bringObjectToFront(overlay)
  canvas.requestRenderAll()
  return { overlay }
}

export async function updateFrame(ctx) {
  // Thickness and color require re-rendering the pixel layer. Replace
  // the previous overlay in-place.
  const { canvas, canvasWidth, canvasHeight, controls, session } = ctx
  if (!session?.overlay) return
  const dataUrl = renderFrameDataUrl(
    canvasWidth,
    canvasHeight,
    controls.thickness ?? DEFAULTS.thickness,
    controls.color ?? DEFAULTS.color
  )
  const next = await fabric.FabricImage.fromURL(dataUrl)
  next.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false
  })
  next.__framePreview = true
  canvas.remove(session.overlay)
  canvas.add(next)
  canvas.bringObjectToFront(next)
  session.overlay = next
  canvas.requestRenderAll()
}

export function commitFrame(ctx) {
  const { canvas, session } = ctx
  if (!session?.overlay) return
  const overlay = session.overlay
  delete overlay.__framePreview
  overlay.deckId = `frame-${Date.now()}-${nextFrameNumber}`
  overlay.deckLabel = `frame #${nextFrameNumber++}`
  overlay.deckKind = 'image'
  canvas.requestRenderAll()
}

export function cleanupFrame(ctx) {
  const { canvas, session } = ctx
  if (!session?.overlay) return
  canvas.remove(session.overlay)
  canvas.requestRenderAll()
}

function renderFrameDataUrl(width, height, thickness, color) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const cx = c.getContext('2d')
  cx.fillStyle = color
  cx.fillRect(0, 0, width, height)
  cx.clearRect(thickness, thickness, width - thickness * 2, height - thickness * 2)
  return c.toDataURL()
}

export function FrameTools({ controls, onControlChange }) {
  return (
    <div className="pencil-tools">
      <label className="ctrl">
        <span className="ctrl-label">Thickness</span>
        <input
          type="range"
          min={5}
          max={120}
          step={1}
          value={controls.thickness ?? DEFAULTS.thickness}
          onChange={(e) => onControlChange('thickness', Number(e.target.value))}
        />
        <span className="ctrl-value">{controls.thickness ?? DEFAULTS.thickness}px</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Color</span>
        <input
          type="color"
          value={controls.color ?? DEFAULTS.color}
          onChange={(e) => onControlChange('color', e.target.value)}
        />
        <span className="ctrl-value mono">{controls.color ?? DEFAULTS.color}</span>
      </label>
      <p className="hint">End commits the frame and exports the composition.</p>
    </div>
  )
}
