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
