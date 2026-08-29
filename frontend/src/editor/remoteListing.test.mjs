// Checks for remoteListing.js's folder reading. Run it directly — no
// framework, no dependency, nothing to install:
//
//   node frontend/src/editor/remoteListing.test.mjs
//
// This is the browser half of a contract whose other half lives in
// backend/image-source.js, and the two are only kept honest by hand. The
// failure mode is quiet: a folder shape we stop recognising doesn't throw, it
// just deals an empty grid — a session that looks like an empty folder rather
// than like a bug. So the three shapes are asserted here, with the responses
// injected: no network, and the exclusions (parent links, absolute hrefs,
// sort-column query strings) are stated as tests rather than as comments.

import {
  keepImages,
  listRemoteFolder,
  namesFromHtml,
  namesFromJson,
  parseFolderUrl,
  remoteImageUrl
} from './remoteListing.js'

let fail = 0
const chk = (name, ok, extra = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${extra ? '   ' + extra : ''}`)
  if (!ok) fail++
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

// A stand-in for fetch's Response: only what listRemoteFolder reads.
const reply = (body, { ok = true, status = 200, type = 'text/html' } = {}) => ({
  ok,
  status,
  headers: { get: (h) => (h.toLowerCase() === 'content-type' ? type : null) },
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
})

// Routes a URL to a fixture; anything unrouted rejects the way a 404 or a
// blocked origin does.
const server = (routes) => async (url) => {
  const key = String(url)
  if (key in routes) return routes[key]
  throw new Error('not served')
}

const BASE = parseFolderUrl('http://zymebox:9000/favorites')

// --- the folder URL ------------------------------------------------------
console.log('\nfolder url')

chk('a folder URL gains its trailing slash', BASE.href === 'http://zymebox:9000/favorites/', BASE.href)
chk('query and hash are dropped', parseFolderUrl('http://h/f/?sort=name#top').href === 'http://h/f/')
chk('a name resolves against the folder, not its parent',
  remoteImageUrl(BASE, 'a.jpg') === 'http://zymebox:9000/favorites/a.jpg')
chk('a name with spaces and #s is encoded',
  remoteImageUrl(BASE, 'two words #3.png') === 'http://zymebox:9000/favorites/two%20words%20%233.png')
chk('a non-http source is refused', (() => {
  try {
    parseFolderUrl('/home/stew/pictures')
    return false
  } catch {
    return true
  }
})())

// --- the filter ----------------------------------------------------------
console.log('\nkeepImages')

chk('non-images, paths and duplicates are dropped, the rest sorted',
  same(keepImages(['b.png', 'notes.txt', 'sub/a.jpg', 'a.jpg', 'b.png', '', 'x.WEBP', 'no-extension']),
    ['a.jpg', 'b.png', 'x.WEBP']))
chk('a windows path separator is a path too', same(keepImages(['sub\\a.jpg']), []))
chk('a bare dotfile is not an image', same(keepImages(['.jpg']), []))

// --- shape 1: index.json -------------------------------------------------
console.log('\nindex.json')

chk('the documented { images: [...] } shape', same(namesFromJson({ images: ['b.png', 'a.jpg'] }), ['b.png', 'a.jpg']))
chk('entries may be objects with file or name', same(
  namesFromJson({ images: [{ file: 'a.jpg' }, { name: 'b.png' }, { nothing: 1 }]}), ['a.jpg', 'b.png']))
chk('{ files: [...] } is accepted too', same(namesFromJson({ files: ['a.jpg'] }), ['a.jpg']))
chk('an unrecognised object is not a listing', namesFromJson({ count: 3 }) === null)

{
  const res = await listRemoteFolder(BASE, {
    get: server({
      'http://zymebox:9000/favorites/index.json': reply({ images: ['b.png', 'readme.md', 'a.jpg'] }, { type: 'application/json' })
    })
  })
  chk('index.json answers first and wins', res.via === 'index.json' && same(res.filenames, ['a.jpg', 'b.png']),
    `${res.via}: ${res.filenames.join(' ')}`)
}

// --- shape 2: the JSON autoindex -----------------------------------------
console.log('\njson autoindex')

chk('a bare array of { name, type } (nginx)', same(
  namesFromJson([{ name: 'a.jpg', type: 'file' }, { name: 'b.png', type: 'file' }]), ['a.jpg', 'b.png']))

{
  // No index.json here: the folder page itself answers with JSON.
  const res = await listRemoteFolder(BASE, {
    get: server({
      'http://zymebox:9000/favorites/': reply(
        [{ name: 'b.png', type: 'file' }, { name: 'sub', type: 'directory' }, { name: 'a.jpg', type: 'file' }],
        { type: 'application/json' }
      )
    })
  })
  chk('the folder page\'s JSON is read when index.json is absent',
    res.via === 'JSON autoindex' && same(res.filenames, ['a.jpg', 'b.png']),
    `${res.via}: ${res.filenames.join(' ')}`)
}

{
  // An empty index.json must not end the search — the folder page may still
  // list files (this is the case that silently deals an empty grid).
  const res = await listRemoteFolder(BASE, {
    get: server({
      'http://zymebox:9000/favorites/index.json': reply({ images: [] }, { type: 'application/json' }),
      'http://zymebox:9000/favorites/': reply(['a.jpg'], { type: 'application/json' })
    })
  })
  chk('an empty index.json falls through to the folder page', same(res.filenames, ['a.jpg']))
}

// --- shape 3: directory-page hrefs ---------------------------------------
console.log('\ndirectory page')

const AUTOINDEX = `<html><head><title>Index of /favorites</title></head><body>
<h1>Index of /favorites</h1><table>
<tr><th><a href="?C=N;O=D">Name</a></th><th><a href="?C=M;O=A">Last modified</a></th></tr>
<tr><td><a href="../">Parent Directory</a></td></tr>
<tr><td><a href="/favorites/root-relative.jpg">root-relative.jpg</a></td></tr>
<tr><td><a href="http://elsewhere/absolute.jpg">absolute.jpg</a></td></tr>
<tr><td><a href="sub/">sub/</a></td></tr>
<tr><td><a href='b.png'>b.png</a></td></tr>
<tr><td><a href="a%20one.jpg?v=2">a one.jpg</a></td></tr>
<tr><td><a href="notes.txt">notes.txt</a></td></tr>
<tr><td><a href="#top">back to top</a></td></tr>
</table></body></html>`

{
  const names = namesFromHtml(AUTOINDEX)
  // The parent and subfolder links survive the href scrape and die in the
  // filter (they carry a slash) — the same division of labour as the backend.
  chk('the parent link is dropped by the filter, not the scrape',
    names.includes('../') && keepImages(names).length === 2)
  chk('root-relative and absolute hrefs are skipped',
    !names.some((n) => n.includes('root-relative') || n.includes('absolute')))
  chk('a sort-column query href is skipped', !names.some((n) => n.startsWith('?') || n.includes('C=N')))
  chk('a query string is trimmed off a real file', names.includes('a one.jpg'))
  chk('percent-encoding is decoded', names.includes('a one.jpg'))
  chk('single-quoted hrefs count too', names.includes('b.png'))
}

{
  const res = await listRemoteFolder(BASE, {
    get: server({ 'http://zymebox:9000/favorites/': reply(AUTOINDEX) })
  })
  chk('the whole page reduces to its images, sorted',
    res.via === 'directory page hrefs' && same(res.filenames, ['a one.jpg', 'b.png']),
    `${res.via}: ${res.filenames.join(' | ')}`)
}

// --- the failures --------------------------------------------------------
console.log('\nfailures')

{
  let message = ''
  try {
    await listRemoteFolder(BASE, { get: server({}) })
  } catch (err) {
    message = err.message
  }
  chk('an unreachable folder names both causes it could have',
    message.includes('unreachable') && message.includes('CORS'), message)
}

{
  let message = ''
  try {
    await listRemoteFolder(BASE, {
      get: server({ 'http://zymebox:9000/favorites/': reply('nope', { ok: false, status: 403 }) })
    })
  } catch (err) {
    message = err.message
  }
  chk('a refusing server reports its status', message.includes('403'), message)
}

{
  const res = await listRemoteFolder(BASE, {
    get: server({ 'http://zymebox:9000/favorites/': reply('{oops', { type: 'application/json' }) })
  })
  chk('unparseable JSON is retried as markup, not thrown', same(res.filenames, []), res.via)
}

console.log(fail ? `\n${fail} FAILED\n` : '\nall checks passed\n')
process.exit(fail ? 1 : 0)
