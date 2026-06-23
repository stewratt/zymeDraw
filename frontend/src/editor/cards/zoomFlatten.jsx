import * as fabric from 'fabric'

// Zoom & Flatten — collapses the canvas to one image, then zooms in 30–50%.
//
// Like Flatten, the async snapshot happens in begin() so commit() stays sync.
// The zoom factor is rolled once per draw (chance is part of the game). The
// zoomed image is centered on the fixed 800×1000 canvas, so the magnified edges
// fall outside the frame and are clipped at export — that clipping is the
// "trim to the new framing." The snapshot is exactly canvas-sized, so the
// image's own width/height give us the canvas center without needing dims.

let nextZoomNumber = 1

export async function beginZoomFlatten(ctx) {
  const { canvas, report } = ctx
  const dataUrl = canvas.toDataURL({ multiplier: 1 })
  const image = await fabric.FabricImage.fromURL(dataUrl)
  const zoom = 1.3 + Math.random() * 0.2 // 1.30–1.50 → 30–50% zoom-in
  report({ zoomPercent: Math.round((zoom - 1) * 100) })
  return { image, zoom }
}

export function commitZoomFlatten(ctx) {
  const { canvas, session } = ctx
  if (!session?.image) return

  const oldObjects = canvas.getObjects().filter((o) => o.deckId)
  for (const o of oldObjects) canvas.remove(o)

  const img = session.image
  img.set({
    originX: 'center',
    originY: 'center',
    left: img.width / 2,
    top: img.height / 2,
    scaleX: session.zoom,
    scaleY: session.zoom,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false
  })
  img.deckId = `zoom-${Date.now()}-${nextZoomNumber}`
  img.deckLabel = `zoomed #${nextZoomNumber++}`
  img.deckKind = 'image'

  canvas.add(img)
  canvas.requestRenderAll()
}

export function cleanupZoomFlatten() {
  // The snapshot lived only in the session until commit — nothing on-canvas
  // to undo.
}

export function ZoomFlattenTools({ info }) {
  const pct = info?.zoomPercent
  return (
    <div className="pencil-tools">
      <p className="hint">
        {pct != null
          ? `Flattens everything into one image, zooms in ${pct}%, and trims to the new framing. Old layers are gone after End — a big committal move.`
          : 'Preparing…'}
      </p>
    </div>
  )
}
