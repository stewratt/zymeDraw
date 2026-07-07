// Panel art — the image under the plate's window (card_maker.md §3.5,
// Phase 3). Sources are BOTH folders (§1.9: the deck's own output feeds the
// deck's faces): entries are tagged strings, `in:<file>` from the input
// folder, `out:<file>` from the export folder, so the reducer keeps holding
// plain filenames and the grid picker's keys stay strings.

import * as fabric from 'fabric'

export async function fetchArtSources() {
  const [inputs, outputs] = await Promise.all([
    fetch('/api/images').then((r) => r.json()).catch(() => ({ ok: false })),
    fetch('/api/outputs').then((r) => r.json()).catch(() => ({ ok: false }))
  ])
  const files = [
    ...(inputs.ok ? inputs.filenames.map((f) => `in:${f}`) : []),
    ...(outputs.ok ? outputs.filenames.map((f) => `out:${f}`) : [])
  ]
  if (files.length === 0) {
    return {
      status: 'error',
      files: [],
      error: inputs.error || outputs.error || 'No images in the input or output folders.'
    }
  }
  return { status: 'ready', files, error: null }
}

export function panelArtUrl(id) {
  const sep = id.indexOf(':')
  const source = id.slice(0, sep)
  const file = id.slice(sep + 1)
  return source === 'out'
    ? `/api/outputs/${encodeURIComponent(file)}`
    : `/api/images/${encodeURIComponent(file)}`
}

// n entries for the panel grid, inputs and exports shuffled together.
export function dealPanelGrid(files, n) {
  const pool = [...files]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(n, pool.length))
}

// Mount the picked art UNDERNEATH the plate matte: bottom of the object
// stack, so the plate's alpha window crops it — no clip rectangle, the
// window's own pixels are the mask. Free-transform stays on (drag/scale/
// rotate under the hole); the image keeps its native-resolution source so
// the 3× bake samples full detail.
export async function mountPanelArt(canvas, id) {
  const img = await fabric.FabricImage.fromURL(panelArtUrl(id))
  const W = canvas.getWidth()
  const H = canvas.getHeight()
  // Cover the whole face by default — the window sits large in the plate,
  // and scaling DOWN from cover is rarer than dragging to reframe.
  const scale = Math.max(W / img.width, H / img.height)
  img.set({
    originX: 'center',
    originY: 'center',
    left: W / 2,
    top: H / 2,
    scaleX: scale,
    scaleY: scale
  })
  canvas.add(img)
  canvas.moveObjectTo(img, 0)
  canvas.requestRenderAll()
  return img
}
