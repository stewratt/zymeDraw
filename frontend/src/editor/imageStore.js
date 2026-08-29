// Where the session's images come from — the one module that knows.
//
// Everything above this line (Editor, the grids, every card that grafts a
// second image in) deals in FILENAMES and asks here for a URL, a listing, or
// a sample. Nothing else mentions /api/images. That is the whole point: the
// desktop reads an input folder through the backend, and a different shell
// can read the same session from somewhere else by installing a different
// SOURCE, without a card file changing (to_do/mobile_plan.md §2.1).
//
// The flavors:
//   - served (the default, desktop): /api/images*, exactly as before — the
//     backend proxies local folders AND http folders, so a cross-origin
//     image never taints the canvas and export can't fail at the Coda.
//   - remote / local (mobile, later waves): a folder URL read client-side
//     (remoteListing.js), or object URLs from the phone's photo picker.
//
// A source is three functions; installImageSource swaps them wholesale.
// Two of them answer with an ENVELOPE rather than throwing, because the
// opening panel's copy distinguishes "the folder said no, here's why" from
// "the request itself failed" — a source that can explain itself should.

// { ok, filenames, error } — the listing envelope. Rejects only on a
// transport failure, which the caller reports with the thrown message.
async function servedList() {
  const res = await fetch('/api/images')
  return res.json()
}

// n filenames from the pool. The backend samples server-side so a folder
// that grew since the listing was read still deals fresh images; the caller
// hands over the listing it already has as the fallback pool.
async function servedSample(n, fallbackList) {
  try {
    const res = await fetch(`/api/images/sample?n=${n}`)
    const data = await res.json()
    if (data.ok && data.filenames.length > 0) return data.filenames
  } catch {
    // fall through to the client-side fallback
  }
  return shuffleTake(fallbackList, n)
}

const servedSource = {
  imageUrl: (filename) => `/api/images/${encodeURIComponent(filename)}`,
  listImages: servedList,
  sampleImages: servedSample
}

let source = servedSource

// A shell installs its source once, before the editor mounts. Partial
// sources fill in from the served one so a flavor only writes what differs.
export function installImageSource(next) {
  source = { ...servedSource, ...next }
}

// The URL to load one image from — for <img src>, Fabric's fromURL, and for
// fetching the bytes themselves (Stamp sends them to the sidecar). Object
// URLs answer a fetch too, so every flavor serves all three uses.
export function imageUrl(filename) {
  return source.imageUrl(filename)
}

export function listImages() {
  return source.listImages()
}

export function sampleImages(n, fallbackList = []) {
  return source.sampleImages(n, fallbackList)
}

// Shared by every source that has no sampling endpoint behind it: shuffle a
// listing we already hold and take from the top.
export function shuffleTake(list, n) {
  const pool = [...list]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(n, pool.length))
}
