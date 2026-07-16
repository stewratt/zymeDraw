// Panel art — the image under the plate's window (card_maker.md §3.5,
// Phase 3). Entries are tagged strings so the reducer keeps holding plain
// filenames and the grid picker's keys stay strings:
//   `art:<file>` — the DEDICATED panel-art folder (`panelArtFolder`, set
//                  from the panel pick; Stew curates card imagery apart
//                  from the main app's pool, 2026-07-07)
//   `in:` / `out:` — the fallback mix (inputs + exports, §1.9) while no
//                  dedicated folder is configured
// The raw input list rides along separately (`inputs`) — the stencil
// cards (Stamp/Char/Rails) always sample the main input pool, whatever
// the panel pick draws from.

import * as fabric from 'fabric'

export async function fetchArtSources() {
  const [inputs, outputs, panel] = await Promise.all([
    fetch('/api/images').then((r) => r.json()).catch(() => ({ ok: false })),
    fetch('/api/outputs').then((r) => r.json()).catch(() => ({ ok: false })),
    fetch('/api/panel-art').then((r) => r.json()).catch(() => ({ ok: false }))
  ])
  const inputFiles = inputs.ok ? inputs.filenames : []
  const dedicated = panel.ok && panel.filenames.length > 0
  const files = dedicated
    ? panel.filenames.map((f) => `art:${f}`)
    : [
        ...inputFiles.map((f) => `in:${f}`),
        ...(outputs.ok ? outputs.filenames.map((f) => `out:${f}`) : [])
      ]
  if (files.length === 0) {
    return {
      status: 'error',
      files: [],
      inputs: inputFiles,
      panelFolder: panel.ok ? panel.folder : null,
      error: panel.error || inputs.error || outputs.error || 'No images to offer.'
    }
  }
  return {
    status: 'ready',
    files,
    inputs: inputFiles,
    panelFolder: dedicated ? panel.folder : null,
    error: null
  }
}

export function panelArtUrl(id) {
  const sep = id.indexOf(':')
  const source = id.slice(0, sep)
  const file = id.slice(sep + 1)
  if (source === 'art') return `/api/panel-art/${encodeURIComponent(file)}`
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
  // Fit the whole image inside the face by default (contain) — the entire
  // image reads at a glance in the plate window, and scaling UP to reframe a
  // detail is rarer than always having to shrink a cover-sized image down.
  const scale = Math.min(W / img.width, H / img.height)
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
