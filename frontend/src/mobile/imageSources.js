// Where the pocket session's images come from — the mobile flavors of the
// image store (editor/imageStore.js), installed once at launch.
//
// Two legs, and a session pool that is simply their union (mobile_plan.md
// §2.1–2.2): a zymebox FOLDER read client-side over http, and PHOTOS picked
// off the phone. Either alone is a session; both together is a session too.
// Everything above this file — the opening grid, Ghost's own grid, placement,
// the graft cards — deals in filenames and never learns which leg answered.
//
// THE FOLDER LEG hands out plain folder URLs. That is the honest Wave 2
// position: a cross-origin image loaded without CORS taints the canvas, and a
// tainted master cannot be read back at the Coda — the export throws. The fix
// is deployment, not code (plan §2.2 point 1: serve the pocket app FROM
// zymebox so app and images share an origin, or put CORS headers on the image
// folder), so nothing here tries to launder the bytes. Wave 5 settles the
// hosting; until then a folder on another origin is a session that composes
// perfectly and fails to save.
//
// THE PHOTOS LEG decodes each pick down to LONG_EDGE_CAP first (§4.3 — a
// 48 MP photo decodes to ~190 MB of bitmap, and a source never needs more
// resolution than the master it bakes into), then serves the downscaled copy
// as an object URL. Those URLs are same-origin: they never taint anything.
// Nothing is uploaded — the photos are read, drawn, and baked on the phone.

import { installImageSource, shuffleTake } from '../editor/imageStore.js'
import { listRemoteFolder, parseFolderUrl, remoteImageUrl } from '../editor/remoteListing.js'

// The master's long edge (masterRaster: 2400×3000). A picked photo is capped
// here — see the header.
export const LONG_EDGE_CAP = 2400

// The live pool. Filenames are the keys everywhere above; `local` maps a
// filename to the object URL of its downscaled copy, and anything not in it
// resolves against the folder base.
const pool = {
  base: null, // URL — the parsed folder, or null while no folder is read
  remote: [], // filenames listed from that folder
  local: new Map() // filename → object URL (downscaled)
}

function poolNames() {
  // Local first: a picked photo named like a folder image shadows it (the
  // registration below already keeps local names unique among themselves).
  return [...pool.local.keys(), ...pool.remote.filter((f) => !pool.local.has(f))]
}

export function poolCount() {
  return poolNames().length
}

// One install for the whole app, at launch: the source functions read the
// live pool above, so a leg that loads later needs no re-install.
export function installMobileImageSource() {
  installImageSource({
    imageUrl: (filename) => {
      const local = pool.local.get(filename)
      if (local) return local
      if (pool.base) return remoteImageUrl(pool.base, filename)
      return filename
    },
    // The store's envelope shape: the shell reports its own errors from the
    // intake screen, so the listing itself can only succeed here.
    listImages: async () => ({ ok: true, filenames: poolNames(), error: null }),
    // No sampling endpoint behind either leg — shuffle what we hold.
    sampleImages: async (n, fallbackList = []) =>
      shuffleTake(fallbackList.length > 0 ? fallbackList : poolNames(), n)
  })
}

// ---- the folder leg ----

// Read a zymebox folder. Throws with a readable message (parseFolderUrl's or
// listRemoteFolder's) — the intake screen prints it as-is.
export async function readFolder(raw) {
  const base = parseFolderUrl(raw)
  const { filenames, via } = await listRemoteFolder(base)
  pool.base = base
  pool.remote = filenames
  return { count: filenames.length, via, base: base.href }
}

export function folderCount() {
  return pool.remote.length
}

// ---- the photos leg ----

export function photoCount() {
  return pool.local.size
}

function fitWithin(w, h, cap) {
  const scale = Math.min(1, cap / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('the image would not decode'))
    img.src = src
  })
}

// A name no other picked photo already has, so picking the same file twice —
// or two files called IMG_0001.jpg from different albums — can't collide in a
// pool keyed by name.
function uniqueName(name) {
  const base = name || 'photo'
  if (!pool.local.has(base)) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let n = 2
  while (pool.local.has(`${stem} (${n})${ext}`)) n++
  return `${stem} (${n})${ext}`
}

// Decode one picked file to a downscaled object URL. createImageBitmap's
// resize is the fast path (it never materializes the full-size bitmap);
// browsers that refuse the options fall back to an <img> decode, which is
// what the element load below is already doing anyway.
async function decodeCapped(file, cap) {
  const sourceUrl = URL.createObjectURL(file)
  try {
    // The element first, for the intrinsic size the resize must preserve —
    // EXIF orientation is applied by the decoder, so these are the dimensions
    // as seen, not as stored.
    const el = await loadImageEl(sourceUrl)
    const { w, h } = fitWithin(el.naturalWidth, el.naturalHeight, cap)
    let source = el
    let bitmap = null
    try {
      bitmap = await createImageBitmap(file, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: 'high'
      })
      source = bitmap
    } catch {
      // Fall through to the element; the draw below scales it just the same.
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(source, 0, 0, w, h)
    bitmap?.close?.()
    // PNG only where transparency could be lost; everything else is a photo.
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('the photo would not encode'))), type, 0.92)
    })
    return { url: URL.createObjectURL(blob), width: w, height: h }
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

// Register picked files in the pool. Returns { added, errors } — one bad
// photo is one skipped photo, never a failed intake.
export async function addPhotos(files, cap = LONG_EDGE_CAP) {
  let added = 0
  const errors = []
  for (const file of files) {
    try {
      const { url } = await decodeCapped(file, cap)
      pool.local.set(uniqueName(file.name), url)
      added++
    } catch (err) {
      errors.push(`${file.name || 'photo'}: ${err.message}`)
    }
  }
  return { added, errors }
}
