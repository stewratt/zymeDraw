// Reading an http folder from the browser — the same folder contract the
// backend reads (backend/image-source.js), ported so a shell with no backend
// in the middle still understands the same three listing shapes
// (to_do/mobile_plan.md §2.2 point 3). One convention, both apps: an
// index.json if the folder documents itself, a JSON autoindex if the server
// offers one, otherwise the hrefs on its directory page.
//
// What changes off the backend: no streams and no `path` (extname is four
// lines here), and the fetch is a plain cross-origin one — so a folder that
// sends no CORS headers fails HERE rather than being proxied through. That is
// a deployment question, not a parsing one; see the plan's §2.2 point 1.
//
// Nothing imports this yet — the image store's remote flavor is Wave 2.

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

// One deadline for the whole listing rather than one per request: a host that
// never answers would otherwise cost the index.json timeout AND the
// directory-page timeout before the caller could report it.
const LISTING_TIMEOUT_MS = 10000

function extname(name) {
  const cut = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  const base = name.slice(cut + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : ''
}

// "http://zymebox:9000/favorites/" → a folder base. Anything without an
// http(s) scheme throws: unlike the backend there is no local-path branch to
// fall through to here.
export function parseFolderUrl(raw) {
  const trimmed = (raw || '').trim()
  if (!trimmed) throw new Error('no folder URL given')
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('that is not an http(s) URL')
  let url
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('that URL could not be parsed')
  }
  // A folder URL must end in a slash, or new URL('a.jpg', base) would resolve
  // against the PARENT directory and we'd quietly read the wrong folder.
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  url.search = ''
  url.hash = ''
  return url
}

// The name is encoded, never interpolated: a folder is free to hold files
// with spaces and #s in them.
export function remoteImageUrl(base, filename) {
  return new URL(encodeURIComponent(filename), base).href
}

// Flat folders only, mirroring the backend: no recursion into
// subdirectories, images only, sorted and deduped.
export function keepImages(names) {
  const seen = new Set()
  const out = []
  for (const name of names) {
    if (typeof name !== 'string' || !name) continue
    if (name.includes('/') || name.includes('\\')) continue
    if (!IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) continue
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
export function namesFromJson(data) {
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
export function namesFromHtml(html) {
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

// Returns { filenames, via } — `via` names which shape answered, which is
// worth surfacing when a folder is being configured for the first time.
// `get` is injectable so the parsing above can be tested without a network.
export async function listRemoteFolder(base, { get } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LISTING_TIMEOUT_MS)
  const fetchOne =
    get ?? ((url) => fetch(url, { signal: controller.signal, redirect: 'follow', mode: 'cors' }))
  try {
    // index.json first: exact, one small request, and it says what the folder
    // means rather than what its web page happens to look like.
    try {
      const res = await fetchOne(new URL('index.json', base))
      if (res.ok) {
        const names = namesFromJson(await res.json())
        if (names && names.length > 0) return { filenames: keepImages(names), via: 'index.json' }
      }
    } catch {
      // No index.json, it isn't JSON, or CORS refused it. Read the folder page.
    }

    let res
    try {
      res = await fetchOne(base)
    } catch (err) {
      // There is no err.cause detail to mine in a browser — a refused origin
      // and an unreachable host both surface as the same opaque TypeError —
      // so name both possibilities rather than guess one.
      throw new Error(
        err?.name === 'AbortError'
          ? 'the server did not answer in time'
          : 'the folder could not be fetched — unreachable, or no CORS headers on that origin'
      )
    }
    if (!res.ok) throw new Error(`the server answered ${res.status} for that folder`)

    const body = await res.text()
    if ((res.headers.get('content-type') || '').includes('json')) {
      try {
        const names = namesFromJson(JSON.parse(body))
        if (names) return { filenames: keepImages(names), via: 'JSON autoindex' }
      } catch {
        // Not a listing shape we understand — try it as markup.
      }
    }
    return { filenames: keepImages(namesFromHtml(body)), via: 'directory page hrefs' }
  } finally {
    clearTimeout(timer)
  }
}
