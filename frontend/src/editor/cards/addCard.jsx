import * as fabric from 'fabric'

// Unique ids for tagging committed layers so later cards (Layers panel,
// Eraser, HSV, Blur) can find them.
let deckIdCounter = 1
function makeDeckId(prefix) {
  return `${prefix}-${Date.now()}-${deckIdCounter++}`
}

function sampleWithoutReplacement(pool, n) {
  const copy = [...pool]
  const out = []
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

// Phase 3 behavior, lightly extended:
//   - tags each placed image with deckId / deckLabel / deckKind so the
//     Layers panel can list it after commit.
export async function placeAddCardImages(canvas, count, filenamePool, canvasWidth, canvasHeight) {
  if (!filenamePool || filenamePool.length === 0) {
    return { ok: false, error: 'No images in input folder.', placed: [] }
  }

  const chosen = sampleWithoutReplacement(filenamePool, count)
  const placed = []
  const offsetStep = 50

  for (let i = 0; i < chosen.length; i++) {
    const filename = chosen[i]
    const url = `/api/images/${encodeURIComponent(filename)}`

    let img
    try {
      img = await fabric.FabricImage.fromURL(url)
    } catch (err) {
      console.error(`[addCard] failed to load ${filename}`, err)
      continue
    }

    const maxW = canvasWidth * 0.4
    const maxH = canvasHeight * 0.4
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)

    img.set({
      originX: 'center',
      originY: 'center',
      left: canvasWidth / 2 + (i - (chosen.length - 1) / 2) * offsetStep,
      top: canvasHeight / 2 + (i - (chosen.length - 1) / 2) * offsetStep,
      scaleX: scale,
      scaleY: scale
    })

    img.deckId = makeDeckId('img')
    img.deckLabel = filename
    img.deckKind = 'image'

    canvas.add(img)
    placed.push({ object: img, filename })
  }

  if (placed.length > 0) {
    canvas.setActiveObject(placed[placed.length - 1].object)
  }
  canvas.requestRenderAll()
  return { ok: true, placed, error: null }
}

export function commitAddCardImages(canvas, placed) {
  canvas.discardActiveObject()
  for (const { object } of placed) {
    object.set({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false
    })
  }
  canvas.requestRenderAll()
}

// React component shown in the deck panel during an add-card session.
export function AddCardTools({ info, ready }) {
  const filenames = info?.placedFilenames || []
  return (
    <div className="add-tools">
      <p className="hint">
        {!ready
          ? 'Placing images…'
          : 'Drag to move · corners to scale · top handle to rotate · End commits.'}
      </p>
      {filenames.length > 0 && (
        <ul className="placed-files">
          {filenames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
