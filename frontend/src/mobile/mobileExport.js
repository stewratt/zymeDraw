// Where a finished piece goes on a phone — the mobile export sink
// (editor/exportSink.js installs it; mobile_plan.md §2).
//
// There is no output folder and no backend to write one: the master becomes a
// PNG blob and then takes whichever of two roads the browser allows.
//
//   1. THE SHARE SHEET — navigator.share with the file. On iOS "Save Image"
//      lands it in Photos, which is the whole point. It needs a secure
//      context (https, or localhost), so plain http over the tailnet does not
//      get it (plan §2.2 point 2).
//   2. THE LONG PRESS — the piece rendered into an <img> the user presses and
//      holds to Save to Photos. Works everywhere, including plain http, and
//      is also where a refused or unavailable share sheet lands.
//
// A share the user dismisses is neither a success nor a failure: the piece is
// still here and the sheet can be asked for again, so it reports back as
// `dismissed` and the finish screen keeps offering to save.
//
// The envelope is the store's — { ok, savedPath, error } — plus `via` and
// `blobUrl`, which the mobile finish screen reads and the desktop never sees.
// Only a genuine transport failure rejects; a tainted master (a folder image
// loaded cross-origin — see imageSources.js) throws right here at toBlob, and
// the caller reports it as the export error it is.

import { installExportSink } from '../editor/exportSink.js'

let lastUrl = null

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function masterToBlob(master) {
  return new Promise((resolve, reject) => {
    master.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('the piece could not be written to a PNG'))
    }, 'image/png')
  })
}

export async function mobileExport(master) {
  const blob = await masterToBlob(master)
  // One live blob URL at a time: the previous piece's is finished with.
  if (lastUrl) URL.revokeObjectURL(lastUrl)
  lastUrl = URL.createObjectURL(blob)

  const file = new File([blob], `zyme-${stamp()}.png`, { type: 'image/png' })
  const shareable =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (navigator.canShare?.({ files: [file] }) ?? false)

  if (shareable) {
    try {
      await navigator.share({ files: [file] })
      return { ok: true, savedPath: null, error: null, via: 'share', blobUrl: lastUrl }
    } catch (err) {
      // The user closing the sheet is a choice, not a fault.
      const dismissed = err?.name === 'AbortError'
      return {
        ok: true,
        savedPath: null,
        error: null,
        via: dismissed ? 'dismissed' : 'longpress',
        blobUrl: lastUrl
      }
    }
  }
  return { ok: true, savedPath: null, error: null, via: 'longpress', blobUrl: lastUrl }
}

export function installMobileExportSink() {
  installExportSink(mobileExport)
}
