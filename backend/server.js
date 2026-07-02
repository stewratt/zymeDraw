import express from 'express'
import { promises as fs, constants as fsc } from 'fs'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
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
app.post('/api/ml/:op(cutout|upscale)', express.raw({ type: '*/*', limit: '64mb' }), async (req, res) => {
  try {
    const r = await fetch(`${ML_BASE}/${req.params.op}`, {
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

function timestampSlug() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

app.listen(PORT, () => {
  console.log(`Deck backend listening on http://localhost:${PORT}`)
})
