// Wave 0 throwaway spike (to_do/mobile_plan.md §7) — delete when the wave closes.
//
// The wiring. Everything this page can answer is listed in the plan's Wave 0
// bullet: the memory ceiling, zymebox reachability + taint, EXIF behaviour,
// ctx.filter, share-sheet availability over http, and whether touch + Fabric
// feel right under a thumb. No deck, no shell, no product copy.

import './proof.css'
import { mountReport, say, sayBlank, catchErrors, copyReport, describe } from './report.js'
import { parseFolderUrl, listFolder, imageUrl } from './remoteFolder.js'
import { intakeFile, intakeRemote, taintWords, LONG_EDGE_CAP } from './intake.js'
import { createStage } from './stage.js'
import { createBrush } from './brush.js'
import { filterSupported, findCeiling, exportViaShare, exportViaLongPress } from './probes.js'

const FOLDER_KEY = 'deck-proof-folder-url'
const SCALES = { 2: [1600, 2000], 3: [2400, 3000] }

const $ = (id) => document.getElementById(id)

catchErrors()
mountReport($('report'))

let scale = 2
let placedCount = 0
let sawRemote = false

const stage = createStage($('stage'), $('stage-wrap'))
const brush = createBrush(stage)
stage.reset(...SCALES[scale])

// ── the baseline, written before anything is touched ────────────────────────
say('user agent', navigator.userAgent)
say('screen', `${screen.width}×${screen.height} css px · window ${window.innerWidth}×${window.innerHeight} · devicePixelRatio ${window.devicePixelRatio}`)
say('secure context', String(window.isSecureContext))
say(
  'share API',
  navigator.share
    ? navigator.canShare
      ? 'navigator.share + canShare present'
      : 'navigator.share present, canShare missing'
    : window.isSecureContext
      ? 'absent — this browser does not offer it'
      : 'absent, and this is not a secure context — the Share API is off over plain http (mobile_plan.md §2.2 point 2)'
)
say('ctx.filter', filterSupported() ? 'supported' : 'NOT supported — Blur/Hue/Ghost would silently do nothing')
say('EXIF', 'confirm the first thumbnail is upright — if sideways, EXIF is not applied')
say('master', `${SCALES[scale][0]}×${SCALES[scale][1]} (${scale}×) · artboard ${round(stage.getArtboard().w)}×${round(stage.getArtboard().h)} scene units`)
sayBlank()

function round(n) {
  return Math.round(n * 10) / 10
}

// ── intake: the thumbnail strip both legs feed ──────────────────────────────
function addThumb(item) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = item.remote ? 'thumb thumb--remote' : 'thumb'
  button.title = item.name
  const thumb = document.createElement('canvas')
  thumb.width = 144
  thumb.height = 144
  const ctx = thumb.getContext('2d')
  const s = Math.max(144 / item.canvas.width, 144 / item.canvas.height)
  const w = item.canvas.width * s
  const h = item.canvas.height * s
  ctx.drawImage(item.canvas, (144 - w) / 2, (144 - h) / 2, w, h)
  button.appendChild(thumb)
  button.addEventListener('click', () => {
    stage.place(item.canvas)
    placedCount += 1
    say('placed', `${item.name} — ${placedCount} object(s) on the artboard`)
  })
  $('strip').appendChild(button)
}

function sayIntake(item) {
  say(
    'intake',
    `${item.name} — ${item.origW}×${item.origH} in, ${item.outW}×${item.outH} after the ${LONG_EDGE_CAP}px cap, via ${item.via}`
  )
}

$('file-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  say('photos', `${files.length} picked`)
  for (const file of files) {
    try {
      const item = await intakeFile(file)
      sayIntake(item)
      addThumb(item)
    } catch (err) {
      say('intake FAILED', `${file.name}: ${describe(err)}`)
    }
  }
  e.target.value = ''
})

const folderField = $('folder-url')
folderField.value = localStorage.getItem(FOLDER_KEY) || ''

$('folder-read').addEventListener('click', async () => {
  let base
  try {
    base = parseFolderUrl(folderField.value)
  } catch (err) {
    say('zymebox', describe(err))
    return
  }
  localStorage.setItem(FOLDER_KEY, folderField.value.trim())
  say('zymebox', `reading ${base.href}`)
  let listing
  try {
    listing = await listFolder(base)
  } catch (err) {
    say('zymebox listing FAILED', describe(err))
    return
  }
  say('zymebox listing', `${listing.filenames.length} image(s), read via ${listing.via}`)
  if (!listing.filenames.length) return

  // Four is enough to fill the strip and prove the fetch; the taint answer
  // comes off the first one that loads.
  for (const name of listing.filenames.slice(0, 4)) {
    try {
      const item = await intakeRemote(imageUrl(base, name), name)
      if (item.taint === 'blocked') {
        say('zymebox image', `${name} — ${taintWords('blocked')}`)
        continue
      }
      sawRemote = true
      sayIntake(item)
      say('zymebox image', `${name} — crossOrigin: ${item.crossOriginUsed}${item.note ? ` (${item.note})` : ''}`)
      say('CANVAS TAINT', taintWords(item.taint))
      addThumb(item)
    } catch (err) {
      say('zymebox image FAILED', `${name}: ${describe(err)}`)
    }
  }
})

// ── master scale ────────────────────────────────────────────────────────────
function setScale(next) {
  scale = next
  $('scale-2').classList.toggle('btn--on', scale === 2)
  $('scale-3').classList.toggle('btn--on', scale === 3)
  if (brush.isOn()) {
    brush.off()
    $('brush-toggle').textContent = 'Brush: off'
  }
  stage.reset(...SCALES[scale])
  placedCount = 0
  const [w, h] = SCALES[scale]
  say('master', `${w}×${h} (${scale}×) · artboard ${round(stage.getArtboard().w)}×${round(stage.getArtboard().h)} scene units · artboard cleared`)
}

$('scale-2').addEventListener('click', () => setScale(2))
$('scale-3').addEventListener('click', () => setScale(3))

// ── brush ───────────────────────────────────────────────────────────────────
$('brush-toggle').addEventListener('click', () => {
  if (brush.isOn()) {
    say('brush off', brush.off())
    $('brush-toggle').textContent = 'Brush: off'
  } else {
    const result = brush.on()
    say('brush on', result)
    $('brush-toggle').textContent = brush.isOn() ? 'Brush: on' : 'Brush: off'
  }
})

$('brush-size').addEventListener('input', (e) => brush.setSize(Number(e.target.value)))
brush.setSize(Number($('brush-size').value))

// ── bake ────────────────────────────────────────────────────────────────────
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

// The bake sweeps the brush overlay off with everything else, so the layers are
// rebuilt after it — and a rebuild that can't get its three canvases back is the
// memory finding, so it gets said out loud.
function bakeOnce() {
  const ms = stage.bakeOnce()
  const rebuilt = brush.afterBake()
  if (rebuilt && rebuilt.startsWith('FAILED')) say('brush after bake', rebuilt)
  return ms
}

$('bake-1').addEventListener('click', () => {
  try {
    const ms = bakeOnce()
    say(`bake (${scale}×)`, `${ms.toFixed(0)} ms`)
    probeMasterTaint()
  } catch (err) {
    say('bake FAILED', describe(err))
  }
})

$('bake-10').addEventListener('click', async () => {
  const times = []
  for (let i = 0; i < 10; i += 1) {
    try {
      times.push(bakeOnce())
    } catch (err) {
      say('bake FAILED', `on bake ${i + 1}: ${describe(err)}`)
      break
    }
    await nextFrame()
  }
  if (!times.length) return
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  say(
    `bake ×${times.length} (${scale}×)`,
    `avg ${avg.toFixed(0)} ms · max ${Math.max(...times).toFixed(0)} ms · each ${times.map((t) => t.toFixed(0)).join(', ')}`
  )
  probeMasterTaint()
})

// After anything remote has been baked in, the master is the thing that must
// still be readable — this is the export question asked at the right moment.
function probeMasterTaint() {
  if (!sawRemote) return
  try {
    stage.getMaster().toDataURL()
    say('MASTER AFTER BAKE', 'readable — CORS clean, export safe')
  } catch (err) {
    say('MASTER AFTER BAKE', `TAINTED — export would break here (${describe(err)})`)
  }
}

// ── export ──────────────────────────────────────────────────────────────────
$('export-share').addEventListener('click', async () => {
  try {
    const result = await exportViaShare(stage.getMaster())
    say('export · share sheet', result.ok ? `shared ${(result.bytes / 1e6).toFixed(1)} MB` : `unavailable — ${result.why}`)
  } catch (err) {
    if (err?.name === 'AbortError') {
      say('export · share sheet', 'the sheet opened and was dismissed — the route works')
      return
    }
    say('export · share sheet FAILED', describe(err))
  }
})

$('export-hold').addEventListener('click', async () => {
  try {
    const result = await exportViaLongPress(stage.getMaster(), $('hold-image'), $('hold-overlay'))
    say('export · long-press', `${(result.bytes / 1e6).toFixed(1)} MB PNG on screen — long-press it to save`)
  } catch (err) {
    say('export · long-press FAILED', describe(err))
  }
})

$('hold-close').addEventListener('click', () => {
  $('hold-overlay').hidden = true
})

// ── ceiling ─────────────────────────────────────────────────────────────────
$('ceiling').addEventListener('click', () => {
  const [w, h] = SCALES[scale]
  say('ceiling', `allocating ${w}×${h} canvases…`)
  const result = findCeiling(w, h)
  say(
    `ceiling (${scale}×)`,
    `${result.count} allocation(s) held · ~${result.mb.toFixed(0)} MB (${result.eachMb.toFixed(1)} MB each) · stopped because ${result.stopped}`
  )
})

// ── report ──────────────────────────────────────────────────────────────────
$('copy-report').addEventListener('click', async () => {
  const how = await copyReport()
  $('copy-report').textContent = how === 'clipboard' || how === 'execCommand' ? 'Copied' : 'Copy failed'
  setTimeout(() => {
    $('copy-report').textContent = 'Copy report'
  }, 1600)
})
