// First-launch installer for the ML sidecar's runtime. The installer ships
// only the sidecar *source* + models (~18 MB); this module fetches the heavy
// part — a standalone Python, the pip packages, the u2net weights — into the
// app's per-user data folder on first launch. Everything lands under
// <userData>/ml because the install location itself (AppImage mount,
// Program Files) is read-only.
//
// No Electron imports on purpose: callers pass the base dir, so the whole
// flow can be exercised from plain `node` without building the app.

import { execFileSync, spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Bump to force a re-install on machines that set up an older layout.
// 2: pick the Python by hardware arch, and install wheels only.
const SETUP_VERSION = 2

const PYTHON_TAG = '20241206'
const PYTHON_VERSION = '3.12.8'
const PYTHON_TRIPLES = {
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc'
}

// process.arch is the *Electron binary's* architecture, and an x64 build on
// Apple Silicon runs happily under Rosetta — so it reports 'x64' on hardware
// that has no Intel wheels for numba/llvmlite. The sidecar is a separate
// child process, free to be arm64 under an x64 Electron, so ask the hardware
// rather than the runtime. (No Electron import here on purpose — see above.)
function hardwareArch() {
  if (process.platform === 'darwin' && process.arch === 'x64') {
    try {
      // 1 = this process is being translated. On a genuine Intel Mac the key
      // doesn't exist, sysctl exits non-zero, and x64 correctly stands.
      const translated = execFileSync('sysctl', ['-n', 'sysctl.proc_translated'], {
        stdio: ['ignore', 'pipe', 'ignore']
      })
      if (translated.toString().trim() === '1') return 'arm64'
    } catch {
      /* key absent — not translated */
    }
  }
  return process.arch
}

const HW_ARCH = hardwareArch()

const U2NET_URL =
  'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx'
// Real file is ~176 MB; anything under this is a truncated download. rembg
// hash-checks the file at load time and re-fetches if it's corrupt, so a
// size check here is enough.
const U2NET_MIN_BYTES = 170_000_000

const here = path.dirname(fileURLToPath(import.meta.url))
const ML_SRC_DIR = path.join(here, '..', 'backend', 'ml')

export function mlPaths(baseDir) {
  const root = path.join(baseDir, 'ml')
  return {
    root,
    pythonDir: path.join(root, 'python'),
    python:
      process.platform === 'win32'
        ? path.join(root, 'python', 'python.exe')
        : path.join(root, 'python', 'bin', 'python3'),
    u2netDir: path.join(root, 'u2net'),
    marker: path.join(root, 'ready.json'),
    log: path.join(root, 'install.log')
  }
}

// Env for the sidecar process: rembg reads U2NET_HOME instead of ~/.u2net.
export function mlEnv(baseDir) {
  return { U2NET_HOME: mlPaths(baseDir).u2netDir }
}

export function mlSrcDir() {
  return ML_SRC_DIR
}

// 'ready' | 'missing' | 'unsupported'
export async function mlStatus(baseDir) {
  if (!PYTHON_TRIPLES[`${process.platform}-${HW_ARCH}`]) return 'unsupported'
  const p = mlPaths(baseDir)
  if (!existsSync(p.python)) return 'missing'
  try {
    const marker = JSON.parse(await readFile(p.marker, 'utf8'))
    return marker.setupVersion === SETUP_VERSION ? 'ready' : 'missing'
  } catch {
    return 'missing'
  }
}

async function download(url, dest, report) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed (${res.status}): ${url}`)
  const total = Number(res.headers.get('content-length')) || 0
  let seen = 0
  const counter = new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength
      if (total) report(seen / total)
      controller.enqueue(chunk)
    }
  })
  await pipeline(Readable.fromWeb(res.body.pipeThrough(counter)), createWriteStream(dest))
}

function run(cmd, args, opts, onLine, log) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let tail = ''
    const eat = (data) => {
      const text = data.toString()
      if (log) log(text)
      tail = (tail + text).slice(-4000)
      for (const line of text.split('\n')) {
        const t = line.trim()
        if (t && onLine) onLine(t)
      }
    }
    child.stdout.on('data', eat)
    child.stderr.on('data', eat)
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      // pip signs off with upgrade notices, so a plain tail buries the cause.
      // Its ERROR: lines are the diagnosis — prefer them when there are any.
      const errors = tail
        .split('\n')
        .filter((l) => l.trim().startsWith('ERROR:'))
        .join(' ')
      const why = (errors || tail).slice(-300)
      reject(new Error(`${path.basename(cmd)} exited ${code}: ${why}`))
    })
  })
}

// The whole first-launch flow. Reports { phase, pct?, message? } as it goes;
// phases: 'python' → 'packages' → 'weights'. Returns { ok } or
// { ok: false, error } — it never throws, the app must open regardless.
export async function runMlSetup(baseDir, onProgress = () => {}) {
  const p = mlPaths(baseDir)
  const triple = PYTHON_TRIPLES[`${process.platform}-${HW_ARCH}`]
  if (!triple) return { ok: false, error: `no Python build for ${process.platform}-${HW_ARCH}` }

  // Every byte the child processes print goes here. The error surfaced to the
  // UI is one line by necessity; this is where the rest of it lives.
  await mkdir(p.root, { recursive: true }).catch(() => {})
  const logStream = createWriteStream(p.log, { flags: 'w' })
  const log = (text) => logStream.write(text)
  log(`zyme ml setup — ${process.platform}-${HW_ARCH} (electron arch ${process.arch})\n`)
  log(`python ${PYTHON_VERSION} ${triple}\n\n`)

  try {
    // A previous half-finished attempt just gets rebuilt from scratch —
    // the marker is only ever written after every step has succeeded.
    await rm(p.pythonDir, { recursive: true, force: true })
    await rm(p.marker, { force: true })
    await mkdir(p.u2netDir, { recursive: true })

    const tarball = path.join(p.root, 'python.tar.gz')
    const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_TAG}/cpython-${PYTHON_VERSION}+${PYTHON_TAG}-${triple}-install_only.tar.gz`
    onProgress({ phase: 'python', pct: 0 })
    await download(url, tarball, (pct) => onProgress({ phase: 'python', pct: pct * 0.8 }))
    onProgress({ phase: 'python', pct: 0.8 })
    // System tar handles .tar.gz on all three platforms (Windows 10+ ships
    // bsdtar). The archive unpacks to a single `python/` directory.
    await run('tar', ['-xzf', tarball], { cwd: p.root }, null, log)
    await rm(tarball, { force: true })
    onProgress({ phase: 'python', pct: 1 })

    onProgress({ phase: 'packages' })
    await run(p.python, ['-m', 'ensurepip', '--upgrade'], { cwd: p.root }, null, log)
    // --only-binary=:all: is load-bearing. pip treats a source distribution as
    // a valid candidate and prefers the newest *version* over the installable
    // one, so a missing wheel silently becomes "compile C++ on the user's
    // machine" — which is how Intel macOS ended up building llvmlite. With
    // sdists off the table pip must answer the question we actually meant:
    // the newest release that ships a wheel for THIS interpreter and platform.
    await run(
      p.python,
      ['-m', 'pip', 'install', '--no-cache-dir', '--no-warn-script-location',
        '--only-binary=:all:',
        '-r', path.join(ML_SRC_DIR, 'requirements.txt')],
      { cwd: p.root },
      (line) => onProgress({ phase: 'packages', message: line }),
      log
    )

    const weights = path.join(p.u2netDir, 'u2net.onnx')
    const size = await stat(weights).then((s) => s.size, () => 0)
    if (size < U2NET_MIN_BYTES) {
      onProgress({ phase: 'weights', pct: 0 })
      await download(U2NET_URL, weights, (pct) => onProgress({ phase: 'weights', pct }))
    }
    onProgress({ phase: 'weights', pct: 1 })

    await writeFile(
      p.marker,
      JSON.stringify({ setupVersion: SETUP_VERSION, python: PYTHON_VERSION, arch: HW_ARCH })
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: `${err.message}\nFull log: ${p.log}` }
  } finally {
    logStream.end()
  }
}
