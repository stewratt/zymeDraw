// Wave 0 throwaway spike (to_do/mobile_plan.md §7) — delete when the wave closes.
//
// A browser-side port of backend/image-source.js's listing logic (§2.2 point 3):
// index.json first, then a JSON autoindex, then plain directory-page hrefs.
// Same folder contract, no Express in the middle. The only substantive change
// is that path.extname becomes a four-line helper — there is no `path` here.
//
// Reading the folder from the page is itself a measurement: cross-origin fetch
// needs CORS headers, so a listing that fails here is the same answer the taint
// probe gives, one step earlier.

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const LISTING_TIMEOUT_MS = 10000

function extname(name) {
  const cut = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  const base = name.slice(cut + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : ''
}

// "http://zymebox:9000/favorites/" → a folder base. Anything without an http(s)
// scheme is rejected outright: on the phone there is no local-path fallback.
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

export function imageUrl(base, filename) {
  return new URL(encodeURIComponent(filename), base).href
}

// Flat folders only, images only, sorted and deduped — mirrors the backend.
function keepImages(names) {
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

// The documented contract: an index.json holding { images: [...] }. Entries may
// be plain strings or objects with a `file`/`name` key. A bare array covers
// nginx's JSON autoindex, whose entries look like { name, type }.
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
// Caddy autoindex). Only same-directory relative hrefs count.
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

// Returns { filenames, via } — `via` names which shape answered, which is half
// the finding (question 9 in the plan's §8 asks exactly this).
export async function listFolder(base) {
  // One deadline for the whole listing, as on the desktop: a host that never
  // answers would otherwise cost two full timeouts before we could report it.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LISTING_TIMEOUT_MS)
  const get = (url) => fetch(url, { signal: controller.signal, redirect: 'follow', mode: 'cors' })
  try {
    try {
      const res = await get(new URL('index.json', base))
      if (res.ok) {
        const names = namesFromJson(await res.json())
        if (names && names.length > 0) return { filenames: keepImages(names), via: 'index.json' }
      }
    } catch {
      // No index.json, it isn't JSON, or CORS refused it. Try the folder page.
    }

    let res
    try {
      res = await get(base)
    } catch (err) {
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
