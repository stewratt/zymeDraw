import express from 'express'
import { promises as fs, constants as fsc } from 'fs'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { loadConfig, saveConfig } from './config-store.js'

const app = express()
// Default JSON body limit is 100kb. The /api/export payload is a base64-
// encoded 2400×3000 PNG — easily 5–15 MB. Bump the limit to comfortably hold
// one export.
app.use(express.json({ limit: '64mb' }))
const PORT = 5174

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

// "~/Pictures/foo" → "/Users/stewartbird/Pictures/foo" (or the equivalent on
// Linux/Windows). Saves users from having to type absolute home paths.
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
async function validateFolder(p, mode) {
  if (!p || typeof p !== 'string' || !p.trim()) {
    return { ok: false, error: 'Path is required.' }
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
    validateFolder(inputFolder, 'read'),
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

app.get('/api/images', async (req, res) => {
  const { inputFolder } = await loadConfig()
  if (!inputFolder) {
    return res.status(400).json({ ok: false, error: 'Input folder is not configured.' })
  }
  try {
    const entries = await fs.readdir(inputFolder, { withFileTypes: true })
    const filenames = entries
      .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort()
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
    const entries = await fs.readdir(inputFolder, { withFileTypes: true })
    const filenames = entries
      .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
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

// Defence in depth: basename() strips any "../" before we resolve, and we
// re-verify the resolved path is inside the configured folder. Together they
// rule out path-traversal attacks even if one check is bypassed somehow.
app.get('/api/images/:filename', async (req, res) => {
  const { inputFolder } = await loadConfig()
  if (!inputFolder) return res.status(400).send('Input folder is not configured.')

  const safeName = path.basename(req.params.filename)
  const folderRoot = path.resolve(inputFolder)
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
// Blank card frames with the image window punched as alpha. Local-only
// materials, never committed; the folder defaults to the repo's
// card_template/ (resolved from this file's location, never hardcoded per
// machine) and `platesFolder` in ~/.deck-config.json overrides it.
const DEFAULT_PLATES_FOLDER = fileURLToPath(new URL('../card_template', import.meta.url))

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
const ML_BASE = process.env.DECK_ML_URL || 'http://127.0.0.1:5175'

app.get('/api/ml/health', async (req, res) => {
  try {
    const r = await fetch(`${ML_BASE}/health`, { signal: AbortSignal.timeout(1500) })
    res.json(await r.json())
  } catch {
    res.json({ ok: false })
  }
})

// Body is the image itself (blob), not JSON — hence express.raw here.
// Generous timeout: a cold model load + CPU inference can take minutes.
app.post('/api/ml/:op(cutout|upscale|style)', express.raw({ type: '*/*', limit: '64mb' }), async (req, res) => {
  try {
    const query = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : ''
    const r = await fetch(`${ML_BASE}/${req.params.op}${query}`, {
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

// Reveal the configured output folder in the user's native file manager.
// macOS = `open`, Windows = `explorer`, everywhere else = `xdg-open`.
// We spawn detached/unref'd so the file manager outlives this request.
app.post('/api/open-output', async (req, res) => {
  const { outputFolder } = await loadConfig()
  if (!outputFolder) {
    return res.status(400).json({ ok: false, error: 'Output folder is not configured.' })
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

app.listen(PORT, () => {
  console.log(`Deck backend listening on http://localhost:${PORT}`)
})
