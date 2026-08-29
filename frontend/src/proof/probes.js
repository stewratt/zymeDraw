// Wave 0 throwaway spike (to_do/mobile_plan.md §7) — delete when the wave closes.
//
// The environment questions the plan wants answered on the actual phone:
// ctx.filter support (§4.3's iOS-18 floor), the canvas memory ceiling (§4.1),
// and the two export routes (§2's table, and §2.2 point 2 on secure context).

// Blur/HSV/Ghost silently no-op where 2d ctx.filter is missing. Setting it and
// reading it back is the only honest test — the property exists either way.
export function filterSupported() {
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.filter = 'blur(1px)'
  return ctx.filter === 'blur(1px)'
}

const CEILING_CAP = 60

// Allocate master-sized canvases one at a time until the browser gives out.
// iOS rarely throws — it quietly hands back a canvas that draws nothing — so
// each allocation is written to and read back before it counts.
export function findCeiling(width, height, cap = CEILING_CAP) {
  const held = []
  let stopped = 'reached the cap without failing'
  for (let i = 0; i < cap; i += 1) {
    let el
    try {
      el = document.createElement('canvas')
      el.width = width
      el.height = height
      const ctx = el.getContext('2d')
      if (!ctx) {
        stopped = 'the browser refused a 2d context'
        break
      }
      ctx.fillStyle = '#7f7f7f'
      ctx.fillRect(0, 0, width, height)
      const px = ctx.getImageData(width - 1, height - 1, 1, 1).data
      if (px[3] === 0) {
        stopped = 'the canvas allocated but drew nothing — the memory budget is spent'
        break
      }
      held.push(el)
    } catch (err) {
      stopped = `threw: ${err?.message || err}`
      break
    }
  }
  const each = (width * height * 4) / (1024 * 1024)
  const count = held.length
  for (const el of held) {
    el.width = 0
    el.height = 0
  }
  held.length = 0
  return {
    count,
    mb: count * each,
    eachMb: each,
    stopped
  }
}

function masterToBlob(master) {
  return new Promise((resolve, reject) => {
    try {
      master.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned nothing'))), 'image/png')
    } catch (err) {
      // A tainted canvas throws here — the export failure the whole taint
      // protocol exists to catch before a session reaches the Coda.
      reject(err)
    }
  })
}

// The share sheet: navigator.share with a file lands the PNG in Photos via
// "Save Image". It needs a secure context, so plain http over a tailnet will
// report it missing — that absence is a finding, not a bug.
export async function exportViaShare(master) {
  const blob = await masterToBlob(master)
  const file = new File([blob], 'deck-proof.png', { type: 'image/png' })
  if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
    const why = window.isSecureContext
      ? 'this browser does not offer file sharing'
      : 'not a secure context — the Share API is disabled over plain http'
    return { ok: false, why, bytes: blob.size }
  }
  await navigator.share({ files: [file], title: 'Deck — Wave 0 proof' })
  return { ok: true, bytes: blob.size }
}

// The fallback that works anywhere: put the PNG on screen and let the finger do
// the saving.
export async function exportViaLongPress(master, imgEl, overlayEl) {
  const blob = await masterToBlob(master)
  const url = URL.createObjectURL(blob)
  const previous = imgEl.src
  if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous)
  imgEl.src = url
  overlayEl.hidden = false
  return { bytes: blob.size }
}
