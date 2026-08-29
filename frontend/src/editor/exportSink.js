// Where a finished piece goes — the one module that knows.
//
// Editor owns the Coda's state machine and its copy; this owns only the
// transport. On the desktop that's a POST to the backend, which writes the
// PNG into the configured output folder and answers with the path it wrote.
// A different shell installs a different SINK — the phone's is the Web Share
// API, which hands the blob to Photos (to_do/mobile_plan.md §2) — and the
// FINISHED screen doesn't change, because both answer the same envelope.
//
// { ok, savedPath, error } mirrors the image store's listing envelope: a
// sink that fails for a reason worth reading says so in `error`, and only a
// transport failure rejects.

import { masterToPngDataUrl } from './masterRaster.js'

// The master already holds the true pixels at full resolution, so this is a
// direct read — no multiplier render, nothing to compose first.
async function servedExport(master) {
  const pngBase64 = masterToPngDataUrl(master)
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pngBase64 })
  })
  return res.json()
}

let sink = servedExport

export function installExportSink(next) {
  sink = next ?? servedExport
}

export function exportMaster(master) {
  return sink(master)
}
