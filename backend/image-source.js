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

// Short enough that a folder the image server is still filling still feeds
// new images into a later grid pick (app_plan.md §4), long enough that the
// grid cards don't re-read a 400-entry listing for every deal.
const LISTING_TTL_MS = 30000
// Remote images are addressed by name and the servers we read are
// append-only, so a fetched image is worth keeping for the session. This is
// what stops the same jpg being pulled again for every card that draws it.
const FILE_CACHE_CONTROL = 'private, max-age=3600'

const listingCache = new Map()

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

async function fetchWithTimeout(url, ms, headers) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'follow', headers })
  } finally {
    clearTimeout(timer)
  }
}

// One retry: a proxied folder usually sits on a VPN or LAN link where a
// single dropped connection mid-session is ordinary. Timeouts are NOT
// retried — a server that already spent the whole budget won't do better on
// a second ask, and retrying would double the wait before the tile gives up.
async function fetchImage(url, headers) {
  try {
    return await fetchWithTimeout(url, FILE_TIMEOUT_MS, headers)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return fetchWithTimeout(url, FILE_TIMEOUT_MS, headers)
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

// `fresh` skips the cache in both directions — no hit, no stale fallback.
// Setup's validation uses it so a dead server can't be waved through on the
// strength of a listing we read minutes ago.
export async function listImages(source, { fresh = false } = {}) {
  if (source.kind !== 'remote') {
    // Local folders are deliberately re-read every request: that's what lets
    // a folder being filled by an image server feed each fresh grid pick.
    const entries = await fs.readdir(source.root, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort()
  }

  if (!source.base) throw new Error('that URL could not be parsed')
  const key = source.base.href
  const cached = listingCache.get(key)
  if (!fresh && cached && Date.now() - cached.at < LISTING_TTL_MS) return cached.filenames

  try {
    const filenames = await listRemote(source.base)
    // A handful of configured folders at most; clearing beats tracking an LRU.
    if (listingCache.size > 8) listingCache.clear()
    listingCache.set(key, { at: Date.now(), filenames })
    return filenames
  } catch (err) {
    // The server went away mid-session. A listing we already have beats
    // collapsing the session: the names still deal, and any image that can't
    // be fetched fails as one broken tile rather than as a dead deck.
    if (!fresh && cached) return cached.filenames
    throw err
  }
}

// Defence in depth, both branches: basename() strips any "../" (and any
// slash) before the name is used, and the local branch re-verifies the
// resolved path sits inside the configured folder.
function copyImageHeaders(upstream, res) {
  for (const header of ['content-type', 'content-length', 'last-modified', 'etag']) {
    const value = upstream.headers.get(header)
    if (value) res.setHeader(header, value)
  }
  res.setHeader('cache-control', FILE_CACHE_CONTROL)
}

export async function sendImage(source, filename, req, res) {
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

  // Pass the browser's validators upstream so a copy it already holds can be
  // answered with a 304 instead of the whole image again.
  const conditional = {}
  for (const header of ['if-none-match', 'if-modified-since']) {
    const value = req?.headers?.[header]
    if (value) conditional[header] = value
  }

  let upstream
  try {
    upstream = await fetchImage(new URL(encodeURIComponent(safeName), source.base), conditional)
  } catch (err) {
    return res.status(502).send(`Cannot reach the image server: ${describeFetchError(err)}.`)
  }

  if (upstream.status === 304) {
    copyImageHeaders(upstream, res)
    return res.status(304).end()
  }
  if (!upstream.ok || !upstream.body) {
    return res.status(upstream.status === 404 ? 404 : 502).send('Failed to fetch image.')
  }

  copyImageHeaders(upstream, res)
  // A mid-stream failure can't become a status code — the headers are already
  // out — so drop the connection and let the browser report a broken image.
  Readable.fromWeb(upstream.body)
    .on('error', () => res.destroy())
    .pipe(res)
}
