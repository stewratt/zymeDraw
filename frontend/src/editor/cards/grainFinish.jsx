import * as fabric from 'fabric'

// Grain Finish — Phase 5 endgame card.
//
// Combines two effects:
//  1. A random noise overlay at the top of the stack (like the midgame
//     Canvas Grain card).
//  2. A fixed -0.2 Saturation filter applied to every image layer.
// The user controls grain opacity; saturation is hard-coded so the card
// has a recognizable "look".

let nextGrainFinishNumber = 1
const DESATURATION = -0.2

export async function beginGrainFinish(ctx) {
  const { canvas, canvasWidth, canvasHeight, controls } = ctx
  const dataUrl = generateNoiseDataUrl(canvasWidth, canvasHeight)
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
    opacity: controls.amount ?? 0.4
  })
  overlay.__grainFinishPreview = true
  canvas.add(overlay)
  canvas.bringObjectToFront(overlay)

  const satByLayer = new Map() // deckId → Saturation filter ref
  for (const obj of canvas.getObjects()) {
    if (obj.deckKind !== 'image') continue
    if (obj.__grainFinishPreview) continue
    const sat = new fabric.filters.Saturation({ saturation: DESATURATION })
    obj.filters = [...(obj.filters || []), sat]
    obj.applyFilters()
    satByLayer.set(obj.deckId, sat)
  }

  canvas.requestRenderAll()
  return { overlay, satByLayer }
}

export function updateGrainFinish(ctx) {
  const { canvas, controls, session } = ctx
  if (!session?.overlay) return
  session.overlay.set('opacity', controls.amount ?? 0.4)
  canvas.requestRenderAll()
}

export function commitGrainFinish(ctx) {
  const { canvas, session } = ctx
  if (!session?.overlay) return
  const overlay = session.overlay
  delete overlay.__grainFinishPreview
  overlay.deckId = `grain-finish-${Date.now()}-${nextGrainFinishNumber}`
  overlay.deckLabel = `grain finish #${nextGrainFinishNumber++}`
  overlay.deckKind = 'image'
  canvas.requestRenderAll()
}

export function cleanupGrainFinish(ctx) {
  const { canvas, session } = ctx
  if (!session) return
  if (session.overlay) canvas.remove(session.overlay)
  if (session.satByLayer) {
    for (const [deckId, sat] of session.satByLayer.entries()) {
      const obj = canvas.getObjects().find((o) => o.deckId === deckId)
      if (obj) {
        obj.filters = (obj.filters || []).filter((f) => f !== sat)
        obj.applyFilters()
      }
    }
  }
  canvas.requestRenderAll()
}

function generateNoiseDataUrl(width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const cx = c.getContext('2d')
  const img = cx.createImageData(width, height)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 255) | 0
    data[i] = n
    data[i + 1] = n
    data[i + 2] = n
    data[i + 3] = 255
  }
  cx.putImageData(img, 0, 0)
  return c.toDataURL()
}

export function GrainFinishTools({ controls, onControlChange }) {
  return (
    <div className="pencil-tools">
      <label className="ctrl">
        <span className="ctrl-label">Amount</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={controls.amount ?? 0.4}
          onChange={(e) => onControlChange('amount', Number(e.target.value))}
        />
        <span className="ctrl-value">{(controls.amount ?? 0.4).toFixed(2)}</span>
      </label>
      <p className="hint">
        Fresh noise + a slight desaturation across all images. End commits and
        exports.
      </p>
    </div>
  )
}
