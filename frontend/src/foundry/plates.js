// The plate deck — folder plates as alpha mattes (card_maker.md §3.5).
//
// A plate is a PNG frame with the image window punched through as REAL
// alpha. It mounts as the MATTE ON TOP, not the background: panel art
// (Phase 3) goes underneath, and the plate's own transparency crops it —
// whatever edge detail the plate carries, no clip rectangle anywhere.

import * as fabric from 'fabric'

export async function fetchPlateList() {
  try {
    const res = await fetch('/api/plates')
    const data = await res.json()
    if (data.ok && data.filenames.length > 0) {
      return { status: 'ready', filenames: data.filenames, folder: data.folder, error: null }
    }
    return {
      status: 'error',
      filenames: [],
      folder: data.folder ?? null,
      error: data.error ?? 'No .png plates in the plates folder.'
    }
  } catch (err) {
    return { status: 'error', filenames: [], folder: null, error: err.message }
  }
}

export function plateUrl(file) {
  return `/api/plates/${encodeURIComponent(file)}`
}

// The whole folder as the offer, in listing order — the plate is CHOSEN,
// never dealt (Stew, 2026-07-07: certain plates for certain cards). Entries
// stay ids and filenames only, the deck.js law.
export function plateEntries(filenames) {
  return filenames.map((file) => ({ id: file, file }))
}

// Re-color the mounted plate: hue-rotate + saturate drawn through the 2d
// canvas filter (the Bruise/Turn pattern — GPU-fast, alpha preserved, so
// the punched window survives). Always draws from the UNTINTED source the
// caller kept from mount time — tints never compound. The tinted element
// carries the plate's native resolution, so the 3× bake loses nothing.
export function tintPlate(img, source, { h, s }) {
  if (h === 0 && s === 100) {
    img.setElement(source)
    return
  }
  const el = document.createElement('canvas')
  el.width = source.width
  el.height = source.height
  const ctx = el.getContext('2d')
  ctx.filter = `hue-rotate(${h}deg) saturate(${s}%)`
  ctx.drawImage(source, 0, 0)
  img.setElement(el)
}

// Mount the taken plate over the whole face: exact fit, non-interactive
// (the plate is a given, not an arrangeable object). It stays the TOPMOST
// object until the Press seals it — Phase 3 inserts panel art below it,
// and the type layer (Phase 4) is the one thing allowed above.
export async function mountPlate(canvas, file) {
  const img = await fabric.FabricImage.fromURL(plateUrl(file))
  img.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: canvas.getWidth() / img.width,
    scaleY: canvas.getHeight() / img.height,
    selectable: false,
    evented: false
  })
  canvas.add(img)
  canvas.requestRenderAll()
  return img
}
