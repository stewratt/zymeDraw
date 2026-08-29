// Wave 0 throwaway spike (to_do/mobile_plan.md §7) — delete when the wave closes.
//
// Intake: a picked file or a remote URL becomes ONE downscaled canvas element,
// capped at the master's long edge (§4.3 — a 48 MP HEIC decodes to ~190 MB of
// bitmap, and a source never needs more resolution than the master it bakes
// into). Fabric wants an element, not an ImageBitmap, so the canvas is both the
// downscale and the source.
//
// The remote leg also carries the taint protocol, which is the single most
// important thing this page measures: try crossOrigin 'anonymous' first, fall
// back to a plain load, then probe whether anything drawn from that image can
// still be read back out of a canvas.

export const LONG_EDGE_CAP = 2400

function fitWithin(w, h, cap) {
  const scale = Math.min(1, cap / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

function drawToCanvas(source, w, h) {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  el.getContext('2d').drawImage(source, 0, 0, w, h)
  return el
}

function loadImageEl(src, crossOrigin) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('the image would not load'))
    img.src = src
  })
}

// Can pixels drawn from this image be read back? Cheap 1×1 probe — the same
// question toDataURL asks at export, asked at intake so a session can't get all
// the way to the Coda before discovering the answer.
export function probeReadable(source) {
  const el = document.createElement('canvas')
  el.width = 1
  el.height = 1
  try {
    el.getContext('2d').drawImage(source, 0, 0, 1, 1)
    el.toDataURL()
    return true
  } catch {
    return false
  }
}

// A picked photo. The <img> is loaded first only to learn the intrinsic size
// (EXIF already applied by the decoder) so the resize can preserve the aspect;
// it doubles as the fallback source if createImageBitmap refuses the options.
export async function intakeFile(file, cap = LONG_EDGE_CAP) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageEl(url)
    const origW = img.naturalWidth
    const origH = img.naturalHeight
    const { w, h } = fitWithin(origW, origH, cap)
    let canvas
    let via
    try {
      const bmp = await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
      canvas = drawToCanvas(bmp, w, h)
      bmp.close?.()
      via = 'createImageBitmap'
    } catch (err) {
      canvas = drawToCanvas(img, w, h)
      via = `<img> fallback (createImageBitmap: ${err?.message || err})`
    }
    return {
      name: file.name || 'photo',
      canvas,
      origW,
      origH,
      outW: w,
      outH: h,
      via,
      remote: false,
      readable: true
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// A zymebox image. Returns a `taint` field of 'clean' | 'tainted' | 'blocked',
// which the report turns into plain words.
export async function intakeRemote(url, name, cap = LONG_EDGE_CAP) {
  let img = null
  let crossOriginUsed = 'anonymous'
  let note = ''
  try {
    img = await loadImageEl(url, 'anonymous')
  } catch {
    // A CORS-less server refuses the anonymous request outright. Retry plain:
    // the image will draw, but every canvas it touches becomes unreadable.
    crossOriginUsed = 'none'
    note = 'anonymous load failed; loaded without crossOrigin'
    try {
      img = await loadImageEl(url)
    } catch {
      return { name, taint: 'blocked', crossOriginUsed: 'none', note: 'would not load either way' }
    }
  }

  const readable = probeReadable(img)
  const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, cap)
  return {
    name,
    canvas: drawToCanvas(img, w, h),
    origW: img.naturalWidth,
    origH: img.naturalHeight,
    outW: w,
    outH: h,
    via: 'remote <img> decode',
    remote: true,
    crossOriginUsed,
    note,
    readable,
    taint: readable ? 'clean' : 'tainted'
  }
}

export function taintWords(state) {
  if (state === 'clean') return 'CORS clean — export safe'
  if (state === 'tainted') {
    return 'loads but TAINTS the canvas — export would break; zymebox needs CORS headers or same-origin hosting'
  }
  return "won't load at all"
}
