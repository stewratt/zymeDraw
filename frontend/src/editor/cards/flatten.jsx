import * as fabric from 'fabric'

// Flatten — Phase 4.3 midgame card.
//
// Collapses the entire canvas into one image. After commit, every prior
// committed layer is gone and a single "flattened" image replaces them.
// Future cards see exactly one image layer to work on.
//
// Why begin() does the work: FabricImage.fromURL is async. If we did the
// flatten in commit(), the state machine (in Editor.jsx) would race
// against the in-flight image load. Doing it in begin() means by the time
// the user presses End the new FabricImage is already cached in the card
// session — commit() just swaps objects synchronously.

let nextFlatNumber = 1

export async function beginFlatten(ctx) {
  const { canvas } = ctx
  // Snapshot the visible canvas. multiplier:1 = exact pixel size of the
  // working canvas. The export pipeline (Phase 5) uses 3 for print-res.
  const dataUrl = canvas.toDataURL({ multiplier: 1 })
  const image = await fabric.FabricImage.fromURL(dataUrl)
  return { image }
}

export function commitFlatten(ctx) {
  const { canvas, session } = ctx
  if (!session?.image) return

  const oldObjects = canvas.getObjects().filter((o) => o.deckId)
  for (const o of oldObjects) canvas.remove(o)

  const img = session.image
  img.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false
  })
  img.deckId = `flat-${Date.now()}-${nextFlatNumber}`
  img.deckLabel = `flattened #${nextFlatNumber++}`
  img.deckKind = 'image'

  canvas.add(img)
  canvas.requestRenderAll()
}

export function cleanupFlatten() {
  // Nothing on-canvas to undo; the cached FabricImage was only ever in
  // memory, not added until commit.
}

export function FlattenTools() {
  return (
    <div className="pencil-tools">
      <p className="hint">
        Flatten collapses everything on the canvas into a single image
        layer. Old layers are gone after End — this is a big committal
        move.
      </p>
    </div>
  )
}
