import * as fabric from 'fabric'

// Canvas Grain — Phase 4.6 midgame card.
//
// Adds a noise overlay on top of everything. Random per draw — each time
// the card is begun, a fresh noise data URL is rolled. The amount slider
// controls overlay opacity; on End the overlay becomes a permanently
// tagged image layer at the top of the stack.

let nextGrainNumber = 1

export async function beginGrain(ctx) {
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
    opacity: controls.amount ?? 0.3
  })
  // Mark as a preview so it doesn't appear in the Layers panel (filtered
  // by deckId). It only becomes a real layer on commit.
  overlay.__grainPreview = true
  canvas.add(overlay)
  canvas.bringObjectToFront(overlay)
  canvas.requestRenderAll()
  return { overlay }
}

export function updateGrain(ctx) {
  const { canvas, controls, session } = ctx
  if (!session?.overlay) return
  session.overlay.set('opacity', controls.amount ?? 0.3)
  canvas.requestRenderAll()
}

export function commitGrain(ctx) {
  const { canvas, session } = ctx
  if (!session?.overlay) return
  const overlay = session.overlay
  delete overlay.__grainPreview
  overlay.deckId = `grain-${Date.now()}-${nextGrainNumber}`
  overlay.deckLabel = `grain #${nextGrainNumber++}`
  overlay.deckKind = 'image'
  canvas.requestRenderAll()
}

export function cleanupGrain(ctx) {
  const { canvas, session } = ctx
  if (!session?.overlay) return
  canvas.remove(session.overlay)
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

export function GrainTools({ controls, onControlChange }) {
  return (
    <div className="pencil-tools">
      <label className="ctrl">
        <span className="ctrl-label">Amount</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={controls.amount ?? 0.3}
          onChange={(e) => onControlChange('amount', Number(e.target.value))}
        />
        <span className="ctrl-value">{(controls.amount ?? 0.3).toFixed(2)}</span>
      </label>
      <p className="hint">
        A fresh noise pattern was rolled when this card was drawn. End
        commits the overlay as the top layer.
      </p>
    </div>
  )
}
