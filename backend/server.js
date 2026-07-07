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

app.listen(PORT, () => {
  console.log(`Deck backend listening on http://localhost:${PORT}`)
})
