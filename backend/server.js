import express from 'express'
import { promises as fs, constants as fsc } from 'fs'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import { fileURLToPath, pathToFileURL } from 'url'
import { loadConfig, saveConfig } from './config-store.js'
import { IMAGE_EXTENSIONS, parseRemote, listImages, sendImage } from './image-source.js'

const app = express()
// Default JSON body limit is 100kb. The /api/export payload is a base64-
// encoded 2400×3000 PNG — easily 5–15 MB. Bump the limit to comfortably hold
// one export.
app.use(express.json({ limit: '64mb' }))
// The env override exists for the two deploy stories that sit on this file:
// LAN (pick a port on the image server) and Electron (pick a free port at
// launch). Plain `npm run dev` never sets it.
const PORT = Number(process.env.PORT) || 5174

// "~/Pictures/foo" → "/home/you/Pictures/foo" (or the equivalent on
// Mac/Windows). Saves users from having to type absolute home paths.
function expandTilde(p) {
  if (!p || typeof p !== 'string') return p
  if (p === '~') return os.homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2))
  }
  return p
}

// One validator for both input and output folders. `mode` is 'read' or 'write'.
// Returns `{ ok: true, resolved }` or `{ ok: false, error }`.
//
// `allowUrl` is opt-in per caller, not implied by 'read': the input folder can
// be an http(s) folder, but the plates / cardsets / panel-art folders are read
// with fs.readdir at their own routes and must stay local.
async function validateFolder(p, mode, { allowUrl = false } = {}) {
  if (!p || typeof p !== 'string' || !p.trim()) {
    return { ok: false, error: 'Path is required.' }
  }
  const remote = parseRemote(p)
  if (remote) {
    if (!allowUrl) {
      return { ok: false, error: 'This folder must be a folder on this machine, not a URL.' }
    }
    if (!remote.base) return { ok: false, error: 'That does not look like a valid URL.' }
    try {
      // Never accept a URL on the strength of a cached listing — Setup has to
      // prove the server is answering right now.
      const filenames = await listImages(remote, { fresh: true })
      if (filenames.length === 0) {
        return { ok: false, error: 'That URL is readable but holds no images.' }
      }
      return { ok: true, resolved: remote.base.href }
    } catch (err) {
      return { ok: false, error: `Cannot read that URL — ${err.message}.` }
    }
  }
  const resolved = path.resolve(expandTilde(p.trim()))
  try {
    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) {
      return { ok: false, error: 'Path exists but is not a folder.' }
    }
    await fs.access(resolved, mode === 'read' ? fsc.R_OK : fsc.W_OK)
    return { ok: true, resolved }
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: false, error: 'Folder does not exist.' }
    if (err.code === 'EACCES') {
      return {
        ok: false,
        error: mode === 'read' ? 'Folder is not readable.' : 'Folder is not writable.'
      }
    }
    return { ok: false, error: `Unexpected error: ${err.message}` }
  }
}

app.get('/api/ping', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/config', async (req, res) => {
  const config = await loadConfig()
  res.json({ ...config, homedir: os.homedir() })
})

app.post('/api/config', async (req, res) => {
  const { inputFolder, outputFolder } = req.body ?? {}
  const [input, output] = await Promise.all([
    // Only the input side may be a URL: exports are written and opened on disk.
    validateFolder(inputFolder, 'read', { allowUrl: true }),
    validateFolder(outputFolder, 'write')
  ])
  if (!input.ok || !output.ok) {
    return res.status(400).json({
      ok: false,
      inputFolder: input,
      outputFolder: output
    })
  }
  const saved = await saveConfig({
    inputFolder: input.resolved,
    outputFolder: output.resolved
  })
  res.json({ ok: true, ...saved })
})

// Saved decks (the deck editor's persistence). The whole list is replaced
// on every save — decks are tiny and the room always holds the full set.
// Only the stored shape survives ([{ name, cards: [{ id, copies }] }]),
// mirroring the copy editor's discipline: a client can change values,
// never smuggle in structure. Ids are NOT validated against the card pool
// here — the pool is frontend knowledge; deck.js drops unknown ids itself.
app.post('/api/decks', async (req, res) => {
  const { decks } = req.body ?? {}
  if (!Array.isArray(decks)) {
    return res.status(400).json({ ok: false, error: 'decks must be an array.' })
  }
  const clean = decks.slice(0, 50).map((d) => ({
    name: String(d?.name ?? '').trim().slice(0, 60),
    cards: (Array.isArray(d?.cards) ? d.cards : [])
      .filter((c) => c && typeof c.id === 'string' && Number.isInteger(c.copies) && c.copies > 0)
      .map((c) => ({ id: c.id, copies: Math.min(c.copies, 9) }))
  })).filter((d) => d.name && d.cards.length > 0)
  const saved = await saveConfig({ decks: clean })
  res.json({ ok: true, decks: saved.decks })
})

// The input folder is a local folder or an http(s) one; image-source.js owns
// that fork, so these three routes read the same either way.
function inputSource(inputFolder) {
  return parseRemote(inputFolder) ?? { kind: 'local', root: path.resolve(expandTilde(inputFolder)) }
}

app.get('/api/images', async (req, res) => {
  const { inputFolder } = await loadConfig()
  if (!inputFolder) {
    return res.status(400).json({ ok: false, error: 'Input folder is not configured.' })
  }
  try {
    const filenames = await listImages(inputSource(inputFolder))
    res.json({ ok: true, filenames })
  } catch (err) {
    res.status(400).json({ ok: false, error: `Cannot read input folder: ${err.message}` })
  }
})

// v2: a random sample of n image filenames — the opening grid (and later
// the Ghost/Stamp grids). Must be registered BEFORE /api/images/:filename,
// or Express would treat "sample" as a filename.
app.get('/api/images/sample', async (req, res) => {
  const { inputFolder } = await loadConfig()
  if (!inputFolder) {
    return res.status(400).json({ ok: false, error: 'Input folder is not configured.' })
  }
  const n = Math.max(1, Math.min(64, parseInt(req.query.n, 10) || 1))
  try {
    const filenames = await listImages(inputSource(inputFolder))
    // Fisher–Yates, then take the first n (all of them if the folder holds fewer).
    for (let i = filenames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[filenames[i], filenames[j]] = [filenames[j], filenames[i]]
    }
    res.json({ ok: true, filenames: filenames.slice(0, n) })
  } catch (err) {
    res.status(400).json({ ok: false, error: `Cannot read input folder: ${err.message}` })
  }
})

// Defence in depth (both branches, in image-source.js): basename() strips any
// "../" before we resolve, and the local branch re-verifies the resolved path
// is inside the configured folder. Together they rule out path-traversal
// attacks even if one check is bypassed somehow. A remote folder is proxied
// here rather than redirected to, so the image stays same-origin and the
// canvas never gets tainted (which would break export).
app.get('/api/images/:filename', async (req, res) => {
  const { inputFolder } = await loadConfig()
  if (!inputFolder) return res.status(400).send('Input folder is not configured.')
  await sendImage(inputSource(inputFolder), req.params.filename, req, res)
})

// ---- Foundry: the output folder as an art source (Phase 3) ----
// The deck's own finished pieces feed the deck's faces (card_maker.md
// §1.9): Foundry's panel pick samples the export folder alongside the
// inputs. Same shape and safety as the /api/images pair.
app.get('/api/outputs', async (req, res) => {
  const { outputFolder } = await loadConfig()
  if (!outputFolder) {
    return res.status(400).json({ ok: false, error: 'Output folder is not configured.' })
  }
  try {
    const entries = await fs.readdir(outputFolder, { withFileTypes: true })
    const filenames = entries
      .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort()
    res.json({ ok: true, filenames })
  } catch (err) {
    res.status(400).json({ ok: false, error: `Cannot read output folder: ${err.message}` })
  }
})

app.get('/api/outputs/:filename', async (req, res) => {
  const { outputFolder } = await loadConfig()
  if (!outputFolder) return res.status(400).send('Output folder is not configured.')

  const safeName = path.basename(req.params.filename)
  const folderRoot = path.resolve(outputFolder)
  const resolved = path.resolve(folderRoot, safeName)
  if (!resolved.startsWith(folderRoot + path.sep)) {
    return res.status(400).send('Invalid filename.')
  }
  if (!IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    return res.status(400).send('Not an image.')
  }
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) {
      res.status(err.code === 'ENOENT' ? 404 : 500).send('Failed to send file.')
    }
  })
})

// ---- Foundry: the dedicated panel-art folder ----
// Stew curates card imagery separately from the main app's input pool
// (2026-07-07). `panelArtFolder` in ~/.deck-config.json is optional: when
// set, the panel pick draws from it alone; when absent, the pick falls
// back to the inputs + exports mix. Same shape and safety as /api/plates.
app.get('/api/panel-art', async (req, res) => {
  const { panelArtFolder } = await loadConfig()
  if (!panelArtFolder) {
    return res.json({ ok: false, folder: null, error: 'No panel art folder configured.' })
  }
  const folder = path.resolve(expandTilde(panelArtFolder))
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true })
    const filenames = entries
      .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort()
    res.json({ ok: true, filenames, folder })
  } catch (err) {
    res.status(400).json({ ok: false, folder, error: `Cannot read panel art folder: ${err.message}` })
  }
})

app.get('/api/panel-art/:filename', async (req, res) => {
  const { panelArtFolder } = await loadConfig()
  if (!panelArtFolder) return res.status(400).send('Panel art folder is not configured.')

  const safeName = path.basename(req.params.filename)
  const folderRoot = path.resolve(expandTilde(panelArtFolder))
  const resolved = path.resolve(folderRoot, safeName)
  if (!resolved.startsWith(folderRoot + path.sep)) {
    return res.status(400).send('Invalid filename.')
  }
  if (!IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    return res.status(400).send('Not an image.')
  }
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) {
      res.status(err.code === 'ENOENT' ? 404 : 500).send('Failed to send file.')
    }
  })
})

// Point panelArtFolder somewhere (persisted per machine; saveConfig merges).
app.post('/api/panel-art-folder', async (req, res) => {
  const validated = await validateFolder(req.body?.path, 'read')
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: validated.error })
  }
  await saveConfig({ panelArtFolder: validated.resolved })
  res.json({ ok: true, panelArtFolder: validated.resolved })
})

// ---- Foundry: the plates (card_maker.md §1.1, Phase 2) ----
// Blank card frames with the image window punched as alpha. The default
// set ships with the repo, pre-compressed, in frontend/src/assets/plates/
// (resolved from this file's location, never hardcoded per machine);
// `platesFolder` in ~/.deck-config.json overrides it. Full-res masters
// stay local in card_template/ (gitignored). The listing below is
// top-level files only, so plates/template/ (geometry reference) is
// never dealt as a plate.
const DEFAULT_PLATES_FOLDER = fileURLToPath(new URL('../frontend/src/assets/plates', import.meta.url))

async function resolvePlatesFolder() {
  const { platesFolder } = await loadConfig()
  return platesFolder || DEFAULT_PLATES_FOLDER
}

// Plates must carry real alpha, so the deck is .png only.
app.get('/api/plates', async (req, res) => {
  const folder = await resolvePlatesFolder()
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true })
    const filenames = entries
      .filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === '.png')
      .map((e) => e.name)
      .sort()
    res.json({ ok: true, filenames, folder })
  } catch (err) {
    res.status(400).json({ ok: false, folder, error: `Cannot read plates folder: ${err.message}` })
  }
})

// Same defence in depth as /api/images/:filename.
app.get('/api/plates/:filename', async (req, res) => {
  const folder = await resolvePlatesFolder()
  const safeName = path.basename(req.params.filename)
  const folderRoot = path.resolve(folder)
  const resolved = path.resolve(folderRoot, safeName)
  if (!resolved.startsWith(folderRoot + path.sep)) {
    return res.status(400).send('Invalid filename.')
  }
  if (path.extname(resolved).toLowerCase() !== '.png') {
    return res.status(400).send('Not a plate.')
  }
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) {
      res.status(err.code === 'ENOENT' ? 404 : 500).send('Failed to send file.')
    }
  })
})

// ---- Card face sets (the designed deck art) ----
// The card faces the deck draws — one PNG per card id (745×1040), keyed by
// id (`ghost.png`), never by display name. `cardsetsFolder` in
// ~/.deck-config.json is a per-machine folder holding one SUBFOLDER per
// SET, so whole alternate deck designs drop in side by side:
//   <cardsetsFolder>/charcoal/ghost.png, stain.png, ...
//   <cardsetsFolder>/neon/ghost.png, ...
// Unset = no external sets; the frontend falls back to the committed
// assets/cards/ (the built-in default set). Same safety as /api/plates.
app.get('/api/cards', async (req, res) => {
  const { cardsetsFolder } = await loadConfig()
  if (!cardsetsFolder) {
    return res.json({ ok: false, folder: null, sets: [], error: 'No card sets folder configured.' })
  }
  const folder = path.resolve(expandTilde(cardsetsFolder))
  try {
    const dirs = await fs.readdir(folder, { withFileTypes: true })
    const sets = []
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const files = await fs.readdir(path.join(folder, d.name), { withFileTypes: true })
      const ids = files
        .filter((f) => f.isFile() && path.extname(f.name).toLowerCase() === '.png')
        .map((f) => path.basename(f.name, path.extname(f.name)))
        .sort()
      sets.push({ name: d.name, ids })
    }
    sets.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ ok: true, folder, sets })
  } catch (err) {
    res.status(400).json({ ok: false, folder, sets: [], error: `Cannot read card sets folder: ${err.message}` })
  }
})

// One face: <cardsetsFolder>/<set>/<id>.png. Both segments are basename'd
// and confined to the folder — no traversal out via set or filename.
app.get('/api/cards/:set/:filename', async (req, res) => {
  const { cardsetsFolder } = await loadConfig()
  if (!cardsetsFolder) return res.status(400).send('Card sets folder is not configured.')

  const folderRoot = path.resolve(expandTilde(cardsetsFolder))
  const safeSet = path.basename(req.params.set)
  const safeName = path.basename(req.params.filename)
  const resolved = path.resolve(folderRoot, safeSet, safeName)
  if (!resolved.startsWith(folderRoot + path.sep)) {
    return res.status(400).send('Invalid path.')
  }
  if (path.extname(resolved).toLowerCase() !== '.png') {
    return res.status(400).send('Not a card face.')
  }
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) {
      res.status(err.code === 'ENOENT' ? 404 : 500).send('Failed to send file.')
    }
  })
})

// Point cardsetsFolder somewhere (persisted per machine; saveConfig merges).
app.post('/api/cardsets-folder', async (req, res) => {
  const validated = await validateFolder(req.body?.path, 'read')
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: validated.error })
  }
  await saveConfig({ cardsetsFolder: validated.resolved })
  res.json({ ok: true, cardsetsFolder: validated.resolved })
})

// ---- Foundry: the local font overlay (card_maker.md §1.1, Phase 4) ----
// Loose .ttf/.otf files under <plates>/fonts/<role>/<style>/ join the
// committed OFL set per machine — this is where the proprietary faces
// (Beleren, MPlantin) live, dealt when present, absent without error.
// Zips in the same folders are source material and are ignored.
const FONT_EXTENSIONS = new Set(['.ttf', '.otf'])
const FONT_ROLES = new Set(['title', 'body'])

app.get('/api/fonts', async (req, res) => {
  const base = path.join(await resolvePlatesFolder(), 'fonts')
  const fonts = []
  try {
    for (const role of FONT_ROLES) {
      const roleDir = path.join(base, role)
      let styles = []
      try {
        styles = (await fs.readdir(roleDir, { withFileTypes: true })).filter((e) => e.isDirectory())
      } catch {
        continue // no such role folder on this machine — fine
      }
      for (const styleEntry of styles) {
        const styleDir = path.join(roleDir, styleEntry.name)
        const entries = await fs.readdir(styleDir, { withFileTypes: true })
        for (const e of entries) {
          if (e.isFile() && FONT_EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
            fonts.push({ role, style: styleEntry.name, file: e.name })
          }
        }
      }
    }
    res.json({ ok: true, fonts })
  } catch (err) {
    res.json({ ok: true, fonts: [] }) // overlay is optional — never an error
  }
})

app.get('/api/fonts/:role/:style/:filename', async (req, res) => {
  const { role, style, filename } = req.params
  if (!FONT_ROLES.has(role)) return res.status(400).send('Invalid role.')
  const base = path.join(await resolvePlatesFolder(), 'fonts')
  const folderRoot = path.resolve(path.join(base, role, path.basename(style)))
  const resolved = path.resolve(folderRoot, path.basename(filename))
  if (!resolved.startsWith(path.resolve(base) + path.sep)) {
    return res.status(400).send('Invalid path.')
  }
  if (!FONT_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    return res.status(400).send('Not a font.')
  }
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) {
      res.status(err.code === 'ENOENT' ? 404 : 500).send('Failed to send file.')
    }
  })
})

// Point platesFolder somewhere else (persisted per machine). Validates
// read access; saveConfig merges, so Deck's folders are untouched.
app.post('/api/plates-folder', async (req, res) => {
  const validated = await validateFolder(req.body?.path, 'read')
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: validated.error })
  }
  await saveConfig({ platesFolder: validated.resolved })
  res.json({ ok: true, platesFolder: validated.resolved })
})

// Phase 5: write the final composition to the configured output folder.
// Body shape: { pngBase64: "data:image/png;base64,..." | "<base64>" }.
// Returns { ok: true, savedPath } on success; { ok: false, error } on failure.
app.post('/api/export', async (req, res) => {
  const { outputFolder } = await loadConfig()
  if (!outputFolder) {
    return res.status(400).json({ ok: false, error: 'Output folder is not configured.' })
  }

  const validated = await validateFolder(outputFolder, 'write')
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: `Output folder unusable: ${validated.error}` })
  }

  const { pngBase64 } = req.body ?? {}
  if (typeof pngBase64 !== 'string' || !pngBase64) {
    return res.status(400).json({ ok: false, error: 'Missing pngBase64 in request body.' })
  }

  const rawBase64 = pngBase64.startsWith('data:')
    ? pngBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    : pngBase64

  let buffer
  try {
    buffer = Buffer.from(rawBase64, 'base64')
  } catch (err) {
    return res.status(400).json({ ok: false, error: `Could not decode base64: ${err.message}` })
  }
  if (buffer.length === 0) {
    return res.status(400).json({ ok: false, error: 'Decoded payload is empty.' })
  }

  const filename = `composition_${timestampSlug()}.png`
  const savedPath = path.join(validated.resolved, filename)

  try {
    await fs.writeFile(savedPath, buffer)
  } catch (err) {
    return res.status(500).json({ ok: false, error: `Could not write file: ${err.message}` })
  }

  res.json({ ok: true, savedPath })
})

// ---- Foundry: the Proof's export (card_maker.md §1.1, Phase 6) ----
// Two files per cast into the CASTS folder — the 745×1040 face (drop-in
// ready for assets/cards/<id>.png) and the full-res master. The casts
// folder is `castsFolder` in ~/.deck-config.json, defaulting to
// <outputFolder>/foundry/; filenames carry the commission id + a timestamp
// so iterations never overwrite. Never writes into the repo (§1.1).
function decodePngBase64(pngBase64) {
  if (typeof pngBase64 !== 'string' || !pngBase64) return null
  const raw = pngBase64.startsWith('data:')
    ? pngBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    : pngBase64
  try {
    const buffer = Buffer.from(raw, 'base64')
    return buffer.length > 0 ? buffer : null
  } catch {
    return null
  }
}

app.post('/api/foundry/export', async (req, res) => {
  const { castsFolder, outputFolder } = await loadConfig()
  if (!castsFolder && !outputFolder) {
    return res.status(400).json({ ok: false, error: 'No casts or output folder configured.' })
  }
  const base = castsFolder
    ? path.resolve(expandTilde(castsFolder))
    : path.join(path.resolve(expandTilde(outputFolder)), 'foundry')

  const { id, impression, impressions, facePngBase64, masterPngBase64 } = req.body ?? {}
  const safeId = typeof id === 'string' && /^[a-z0-9-]+$/i.test(id) ? id : 'card'
  const face = decodePngBase64(facePngBase64)
  const master = decodePngBase64(masterPngBase64)
  if (!face || !master) {
    return res.status(400).json({ ok: false, error: 'Missing or undecodable PNG payloads.' })
  }

  // Runs of more than one impression mark which this is: stain_i1_..., i2...
  const mark =
    Number.isInteger(impressions) && impressions > 1 && Number.isInteger(impression)
      ? `_i${impression}`
      : ''
  const slug = `${safeId}${mark}_${timestampSlug()}`
  const savedPath = path.join(base, `${slug}.png`)
  const masterPath = path.join(base, `${slug}_master.png`)
  try {
    await fs.mkdir(base, { recursive: true })
    await fs.writeFile(savedPath, face)
    await fs.writeFile(masterPath, master)
  } catch (err) {
    return res.status(500).json({ ok: false, error: `Could not write cast: ${err.message}` })
  }
  res.json({ ok: true, savedPath, masterPath })
})

// v2 Phase 7: the ML sidecar proxy. Express stays "hands" — it forwards
// raw bytes to the Python process and never inspects them. When the
// sidecar is down these routes answer quickly with ok:false / 503; the
// frontend treats that as "degrade, don't block" (mandatory, CLAUDE.md §3).
// Read per-request, not at load: in Electron the sidecar starts after this
// module (possibly long after — first-launch setup) and announces itself by
// setting DECK_ML_URL to whatever free port it landed on.
const mlBase = () => process.env.DECK_ML_URL || 'http://127.0.0.1:5175'

app.get('/api/ml/health', async (req, res) => {
  try {
    const r = await fetch(`${mlBase()}/health`, { signal: AbortSignal.timeout(1500) })
    res.json(await r.json())
  } catch {
    res.json({ ok: false })
  }
})

// Splatt's pre-warm: no body, no waiting — the sidecar answers at once and
// loads the model on its own thread. Declared before the :op route below
// only for legibility; the paths don't collide.
app.post('/api/ml/splat/warm', async (req, res) => {
  try {
    const r = await fetch(`${mlBase()}/splat/warm`, { method: 'POST', signal: AbortSignal.timeout(1500) })
    res.status(r.status).json(await r.json())
  } catch {
    res.status(503).json({ ok: false, error: 'ML sidecar unavailable.' })
  }
})

// Body is the image itself (blob), not JSON — hence express.raw here.
// Generous timeout: a cold model load + CPU inference can take minutes.
// Responses are buffered whole: PNGs are MBs, a splat .ply is tens of MBs.
app.post('/api/ml/:op(cutout|upscale|style|splat)', express.raw({ type: '*/*', limit: '64mb' }), async (req, res) => {
  try {
    const query = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : ''
    const r = await fetch(`${mlBase()}/${req.params.op}${query}`, {
      method: 'POST',
      headers: { 'content-type': req.get('content-type') || 'application/octet-stream' },
      body: req.body,
      signal: AbortSignal.timeout(300000)
    })
    const buf = Buffer.from(await r.arrayBuffer())
    res
      .status(r.status)
      .type(r.headers.get('content-type') || 'application/octet-stream')
      .send(buf)
  } catch {
    res.status(503).json({ ok: false, error: 'ML sidecar unavailable.' })
  }
})

// The first-launch ML installer runs in the Electron main process; these two
// routes are the frontend's only window onto it (GET = where is it, POST =
// start it). Outside Electron there is nothing to manage — dev machines run
// their own venv (backend/ml/start.js) — so both answer 'unmanaged' and the
// frontend hides the whole surface.
app.get('/api/ml/setup', async (req, res) => {
  if (!native.mlSetupStatus) return res.json({ ok: true, state: 'unmanaged' })
  res.json({ ok: true, ...(await native.mlSetupStatus()) })
})

app.post('/api/ml/setup', async (req, res) => {
  if (!native.mlSetupStart) return res.json({ ok: true, state: 'unmanaged' })
  res.json({ ok: true, ...(await native.mlSetupStart()) })
})

// ---- Native hooks (Electron) -----------------------------------------------
// Browser deployments reach the OS through spawned commands (zenity, xdg-open,
// osascript, powershell). Electron has first-class APIs for the same two jobs
// and injects them here at boot; when unset, the command fallbacks below run.
const native = { pickFolder: null, openFolder: null, mlSetupStatus: null, mlSetupStart: null }
export function setNativeHooks(hooks) {
  Object.assign(native, hooks)
}

// Reveal the configured output folder in the user's native file manager.
// macOS = `open`, Windows = `explorer`, everywhere else = `xdg-open`.
// We spawn detached/unref'd so the file manager outlives this request.
app.post('/api/open-output', async (req, res) => {
  const { outputFolder } = await loadConfig()
  if (!outputFolder) {
    return res.status(400).json({ ok: false, error: 'Output folder is not configured.' })
  }
  if (native.openFolder) {
    return res.json(await native.openFolder(outputFolder))
  }
  const platform = os.platform()
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer' : 'xdg-open'
  try {
    const child = spawn(cmd, [outputFolder], { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Open the OS's native folder-picker dialog and return the absolute path the
// user chose. A browser can't do this (the sandbox never exposes real paths),
// but the backend is a plain Node process on the user's machine, so it can —
// same "backend = hands" reasoning as /api/open-output. Body: { mode:
// 'read'|'write', current?: string } — mode only sets the prompt wording;
// current pre-selects a starting folder where the OS supports it.
//   { ok:true, path }            → user picked a folder
//   { ok:true, path:null, cancelled:true } → user dismissed the dialog
//   { ok:false, error }          → no picker available (degrade to typing)
app.post('/api/pick-folder', async (req, res) => {
  const { mode, current } = req.body ?? {}
  const prompt = mode === 'write' ? 'Choose output folder' : 'Choose input folder'
  const startDir =
    typeof current === 'string' && current.trim()
      ? path.resolve(expandTilde(current.trim()))
      : undefined
  try {
    res.json(await pickFolder(prompt, startDir))
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Spawn a command and capture its stdout. Resolves on close OR error (a
// missing binary emits 'error' and never 'close', so we must handle both —
// that's what lets the Linux zenity→kdialog fallback work).
function runCapture(cmd, args) {
  return new Promise((resolve) => {
    let out = ''
    let done = false
    const finish = (r) => {
      if (!done) {
        done = true
        resolve(r)
      }
    }
    let child
    try {
      child = spawn(cmd, args)
    } catch (err) {
      return finish({ code: -1, out: '', spawnErr: err })
    }
    child.stdout?.on('data', (d) => (out += d.toString()))
    child.on('error', (err) => finish({ code: -1, out: '', spawnErr: err }))
    child.on('close', (code) => finish({ code, out: out.trim(), spawnErr: null }))
  })
}

async function pickFolder(prompt, startDir) {
  if (native.pickFolder) return native.pickFolder(prompt, startDir)

  const platform = os.platform()

  if (platform === 'darwin') {
    // Prompt passed as argv (not string-interpolated) so it can't break the
    // AppleScript. A cancel exits non-zero with no stdout.
    const { code, out } = await runCapture('osascript', [
      '-e', 'on run argv',
      '-e', 'return POSIX path of (choose folder with prompt (item 1 of argv))',
      '-e', 'end run',
      prompt
    ])
    if (code === 0 && out) return { ok: true, path: out.replace(/\/+$/, '') }
    return { ok: true, path: null, cancelled: true }
  }

  if (platform === 'win32') {
    // FolderBrowserDialog needs an STA thread. The prompt is a fixed string,
    // JSON-quoted for safety. Cancel prints nothing.
    const ps =
      'Add-Type -AssemblyName System.Windows.Forms; ' +
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog; ' +
      `$d.Description = ${JSON.stringify(prompt)}; ` +
      (startDir ? `$d.SelectedPath = ${JSON.stringify(startDir)}; ` : '') +
      "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }"
    const { out } = await runCapture('powershell', ['-NoProfile', '-STA', '-Command', ps])
    if (out) return { ok: true, path: out }
    return { ok: true, path: null, cancelled: true }
  }

  // Linux / other: GTK's zenity first, then KDE's kdialog. Neither is
  // guaranteed installed — if both are missing the field stays typeable.
  const zenArgs = ['--file-selection', '--directory', `--title=${prompt}`]
  if (startDir) zenArgs.push(`--filename=${startDir.replace(/\/*$/, '/')}`)
  const zen = await runCapture('zenity', zenArgs)
  if (!zen.spawnErr) {
    if (zen.code === 0 && zen.out) return { ok: true, path: zen.out }
    return { ok: true, path: null, cancelled: true }
  }
  const kd = await runCapture('kdialog', [
    '--getexistingdirectory',
    startDir || os.homedir(),
    '--title', prompt
  ])
  if (!kd.spawnErr) {
    if (kd.code === 0 && kd.out) return { ok: true, path: kd.out }
    return { ok: true, path: null, cancelled: true }
  }
  return {
    ok: false,
    error: 'No native folder picker found (install zenity or kdialog). Type the path instead.'
  }
}

function timestampSlug() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

// ---- The copy editor (dev tool) -------------------------------------------
// All user-facing copy lives in frontend/src/copy/uiText.json; the page at
// /copy-editor edits it through these two routes. The file path is fixed
// server-side — no user-supplied paths. Saving rewrites the file, and Vite
// hot-reloads the running app, so wording changes show up live.

const COPY_FILE = fileURLToPath(new URL('../frontend/src/copy/uiText.json', import.meta.url))
const COPY_EDITOR_PAGE = fileURLToPath(new URL('../tools/copy-editor.html', import.meta.url))

app.get('/copy-editor', (req, res) => {
  res.sendFile(COPY_EDITOR_PAGE)
})

app.get('/api/dev/copy', async (req, res) => {
  try {
    const text = await fs.readFile(COPY_FILE, 'utf8')
    res.json({ ok: true, copy: JSON.parse(text) })
  } catch (err) {
    res.status(500).json({ ok: false, error: `Could not read the copy file: ${err.message}` })
  }
})

// The incoming body must mirror the current file: same keys, string leaves.
// We walk the CURRENT structure and pull values from the submission — so a
// buggy client can change wording but never add, drop, or reorder keys.
function mergeCopy(current, incoming) {
  const merged = {}
  for (const [key, value] of Object.entries(current)) {
    const sent = incoming?.[key]
    if (typeof value === 'string') {
      if (typeof sent !== 'string') throw new Error(`"${key}" must be a string.`)
      merged[key] = sent
    } else {
      merged[key] = mergeCopy(value, sent)
    }
  }
  return merged
}

app.post('/api/dev/copy', async (req, res) => {
  try {
    const current = JSON.parse(await fs.readFile(COPY_FILE, 'utf8'))
    const merged = mergeCopy(current, req.body?.copy)
    await fs.writeFile(COPY_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8')
    res.json({ ok: true, copy: merged })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// ---- Production static serve ----------------------------------------------
// After `npm run build`, the compiled frontend lives in frontend/dist and
// Express serves it — one process, one port, no Vite. These are registered
// LAST so every /api route and /copy-editor keeps precedence. In dev the
// dist folder may not exist; then this whole section is a polite no-op.

const DIST_DIR = fileURLToPath(new URL('../frontend/dist', import.meta.url))
app.use(express.static(DIST_DIR))

app.get('*', (req, res) => {
  // An unmatched /api path is a mistyped route, never the app shell.
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Unknown API route.' })
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) {
      res
        .status(404)
        .send('No production build found. Run `npm run build`, then reload — or use `npm run dev` for development.')
    }
  })
})

// Electron imports this and passes port 0 ("any free port"); the actual
// number is read back off the returned server. `node backend/server.js`
// (dev and npm start) still self-starts via the guard below.
export function startServer(port = PORT) {
  const server = app.listen(port, () => {
    console.log(`Deck backend listening on http://localhost:${server.address().port}`)
  })
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer()
}
