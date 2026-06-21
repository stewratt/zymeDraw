import * as fabric from 'fabric'

// Vignette — Phase 5 endgame card.
//
// Renders a radial-gradient overlay (transparent center, black at edges)
// onto an offscreen canvas, loads it as a FabricImage, and adds it at
// the top of the stack. The user controls opacity; on End the overlay
// becomes a permanent layer and the export pipeline picks it up.

let nextVignetteNumber = 1

export async function beginVignette(ctx) {
  const { canvas, canvasWidth, canvasHeight, controls } = ctx
  const dataUrl = renderVignetteDataUrl(canvasWidth, canvasHeight)
  const overlay = await fabric.FabricImage.fromURL(dataUrl)
  overlay.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    opacity: controls.intensity ?? 0.6
  })
  overlay.__vignettePreview = true
  canvas.add(overlay)
  canvas.bringObjectToFront(overlay)
  canvas.requestRenderAll()
  return { overlay }
}

export function updateVignette(ctx) {
  const { canvas, controls, session } = ctx
  if (!session?.overlay) return
  session.overlay.set('opacity', controls.intensity ?? 0.6)
  canvas.requestRenderAll()
}

export function commitVignette(ctx) {
  const { canvas, session } = ctx
  if (!session?.overlay) return
  const overlay = session.overlay
  delete overlay.__vignettePreview
  overlay.deckId = `vignette-${Date.now()}-${nextVignetteNumber}`
  overlay.deckLabel = `vignette #${nextVignetteNumber++}`
  overlay.deckKind = 'image'
  canvas.requestRenderAll()
}

export function cleanupVignette(ctx) {
  const { canvas, session } = ctx
  if (!session?.overlay) return
  canvas.remove(session.overlay)
  canvas.requestRenderAll()
}

function renderVignetteDataUrl(width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const cx = c.getContext('2d')
  // Center the radial gradient. Outer radius = corner distance.
  const cxx = width / 2
  const cyy = height / 2
  const outer = Math.sqrt(cxx * cxx + cyy * cyy)
  // Hold transparent until ~50% of the radius, then ramp to opaque black.
  const gradient = cx.createRadialGradient(cxx, cyy, outer * 0.5, cxx, cyy, outer)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, 'rgba(0,0,0,1)')
  cx.fillStyle = gradient
  cx.fillRect(0, 0, width, height)
  return c.toDataURL()
}

export function VignetteTools({ controls, onControlChange }) {
  return (
    <div className="pencil-tools">
      <label className="ctrl">
        <span className="ctrl-label">Intensity</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={controls.intensity ?? 0.6}
          onChange={(e) => onControlChange('intensity', Number(e.target.value))}
        />
        <span className="ctrl-value">{(controls.intensity ?? 0.6).toFixed(2)}</span>
      </label>
      <p className="hint">End commits the vignette and exports the composition.</p>
    </div>
  )
}
