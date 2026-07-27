// The input folder is either a folder on this machine or a folder served over
// HTTP. This module owns that fork so the routes in server.js don't have to:
// they build a source, then ask it to list or to send. Everything above the
// backend — Editor, the cards, the grids — only ever sees /api/images.
//
// Remote folders are PROXIED, never redirected. A cross-origin image taints
// the canvas and toDataURL() throws, which would break export at the very end
// of a session; streaming through here keeps every image same-origin. It also
// means a server that sends no CORS headers still works.
import { promises as fs } from 'fs'
import path from 'path'
import { Readable } from 'stream'

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const LISTING_TIMEOUT_MS = 10000
const FILE_TIMEOUT_MS = 30000

// "http://host:9000/favorites/" → a remote source. Anything without an http(s)
// scheme is a local path and returns null, so callers can fall through to their
// own path handling (tilde expansion, resolve) untouched.
export function parseRemote(p) {
  if (!p || typeof p !== 'string') return null
  const trimmed = p.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  let url
  try {
    url = new URL(trimmed)
  } catch {
    // http-ish but unparseable: still a remote source, just a broken one. The
    // caller reports it rather than silently treating it as a local path.
    return { kind: 'remote', base: null }
  }
  // A folder URL must end in a slash, or new URL('a.jpg', base) would resolve
  // against the PARENT directory and we'd quietly fetch the wrong folder.
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  url.search = ''
  url.hash = ''
  return { kind: 'remote', base: url }
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'follow' })
  } finally {
    clearTimeout(timer)
  }
}

// fetch() failures surface as a bare "fetch failed"; the real reason is on
// err.cause. Setup shows these strings, so they have to say something.
function describeFetchError(err) {
  if (err?.name === 'AbortError') return 'the server did not answer in time'
  // When a host resolves to several addresses and every one fails, the cause
  // is an AggregateError and the real code sits on its first member.
  const cause = err?.cause
  const code = cause?.code ?? cause?.errors?.[0]?.code ?? err?.code
  if (code === 'ENOTFOUND') return 'that host could not be found'
  if (code === 'ECONNREFUSED') return 'that host refused the connection'
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'that host is unreachable'
  if (code === 'ETIMEDOUT') return 'the connection timed out'
  return err?.message || 'the request failed'
}

// Flat folders only, mirroring the local branch: no recursion into
// subdirectories, images only, sorted and deduped.
function keepImages(names) {
  const seen = new Set()
  const out = []
  for (const name of names) {
    if (typeof name !== 'string' || !name) continue
    if (name.includes('/') || name.includes('\\')) continue
    if (!IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase())) continue
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out.sort()
}

// The documented contract for a folder that wants to be readable: an
// index.json holding { images: [...] }. Entries may be plain strings or
// objects with a `file`/`name` key. A bare array covers nginx's JSON
// autoindex, whose entries look like { name, type }.
function namesFromJson(data) {
  const entries = Array.isArray(data)
    ? data
    : Array.isArray(data?.images)
      ? data.images
      : Array.isArray(data?.files)
        ? data.files
        : null
  if (!entries) return null
  return entries.map((e) => (typeof e === 'string' ? e : (e?.file ?? e?.name ?? null))).filter(Boolean)
}

// Fallback for vanilla directory listings (Python http.server, nginx/Apache/
// Caddy autoindex). Only same-directory relative hrefs count — absolute URLs,
// root-relative links, parent links and column-sort links are all skipped.
function namesFromHtml(html) {
  const out = []
  const re = /href\s*=\s*["']([^"']+)["']/gi
  let m
  while ((m = re.exec(html)) !== null) {
    let href = m[1]
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue
    if (href.startsWith('/') || href.startsWith('?') || href.startsWith('#')) continue
    href = href.split('?')[0].split('#')[0]
    try {
      out.push(decodeURIComponent(href))
    } catch {
      out.push(href)
    }
  }
  return out
}

async function listRemote(base) {
  // One deadline for the whole listing rather than one per request: a host
  // that never answers would otherwise cost the index.json timeout AND the
  // directory-page timeout before Setup could report it.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LISTING_TIMEOUT_MS)
  const get = (url) => fetch(url, { signal: controller.signal, redirect: 'follow' })
  try {
    // index.json first: exact, one small request, and it says what the folder
    // means rather than what its web page happens to look like.
    try {
      const res = await get(new URL('index.json', base))
      if (res.ok) {
        const names = namesFromJson(await res.json())
        if (names && names.length > 0) return keepImages(names)
      }
    } catch {
      // No index.json, or it isn't JSON. Read the directory page instead.
    }

    let res
    try {
      res = await get(base)
    } catch (err) {
      throw new Error(describeFetchError(err))
    }
    if (!res.ok) throw new Error(`the server answered ${res.status} for that folder`)

    const body = await res.text()
    if ((res.headers.get('content-type') || '').includes('json')) {
      try {
        const names = namesFromJson(JSON.parse(body))
        if (names) return keepImages(names)
      } catch {
        // Not a listing shape we understand — try it as markup.
      }
    }
    return keepImages(namesFromHtml(body))
  } finally {
    clearTimeout(timer)
  }
}

export async function listImages(source) {
  if (source.kind === 'remote') {
    if (!source.base) throw new Error('that URL could not be parsed')
    return listRemote(source.base)
  }
  const entries = await fs.readdir(source.root, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort()
}

// Defence in depth, both branches: basename() strips any "../" (and any
// slash) before the name is used, and the local branch re-verifies the
// resolved path sits inside the configured folder.
export async function sendImage(source, filename, res) {
  const safeName = path.basename(filename)
  if (!IMAGE_EXTENSIONS.has(path.extname(safeName).toLowerCase())) {
    return res.status(400).send('Not an image.')
  }

  if (source.kind === 'local') {
    const folderRoot = path.resolve(source.root)
    const resolved = path.resolve(folderRoot, safeName)
    if (!resolved.startsWith(folderRoot + path.sep)) {
      return res.status(400).send('Invalid filename.')
    }
    return res.sendFile(resolved, (err) => {
      if (err && !res.headersSent) {
        res.status(err.code === 'ENOENT' ? 404 : 500).send('Failed to send file.')
      }
    })
  }

  if (!source.base) return res.status(400).send('Input folder URL could not be parsed.')

  let upstream
  try {
    upstream = await fetchWithTimeout(new URL(encodeURIComponent(safeName), source.base), FILE_TIMEOUT_MS)
  } catch (err) {
    return res.status(502).send(`Cannot reach the image server: ${describeFetchError(err)}.`)
  }
  if (!upstream.ok || !upstream.body) {
    return res.status(upstream.status === 404 ? 404 : 502).send('Failed to fetch image.')
  }

  for (const header of ['content-type', 'content-length', 'last-modified', 'etag']) {
    const value = upstream.headers.get(header)
    if (value) res.setHeader(header, value)
  }
  // A mid-stream failure can't become a status code — the headers are already
  // out — so drop the connection and let the browser report a broken image.
  Readable.fromWeb(upstream.body)
    .on('error', () => res.destroy())
    .pipe(res)
}
