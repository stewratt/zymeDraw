// The font deck (card_maker.md §1.1, §4). Two sources, one catalog:
//
//   - COMMITTED: OFL faces under src/assets/fonts/<style>/<role>/*.ttf,
//     bound by import.meta.glob — identical on every machine, offline-safe.
//   - LOCAL OVERLAY: loose .ttf/.otf files the backend serves from
//     <plates>/fonts/<role>/<style>/ — the proprietary faces (Beleren,
//     MPlantin) that must never be committed. Dealt when present, absent
//     without error (the card-art-placeholder pattern).
//
// The deal is a STYLE PAIRING, not a per-slot draw: one of the styles
// (mtg / pk / jp) is dealt per session; the name and type line set in the
// style's title font, the description in its body font. N re-deals.
//
// Loading discipline (§4): every face is registered via FontFace and
// awaited BEFORE any Fabric text renders in it — an unloaded font silently
// renders as serif and would bake wrong.

const committed = import.meta.glob('../assets/fonts/*/*/*.ttf', {
  eager: true,
  import: 'default',
  query: '?url'
})

function fontName(file) {
  return file.replace(/\.(ttf|otf)$/i, '')
}

// The full catalog: committed set + whatever overlay this machine carries.
// Entries: { id, style, role ('title'|'body'), url, name (FontFace family) }.
export async function fetchFontCatalog() {
  const catalog = []
  for (const [path, url] of Object.entries(committed)) {
    const m = path.match(/fonts\/([^/]+)\/([^/]+)\/([^/]+)$/)
    if (!m) continue
    const [, style, role, file] = m
    catalog.push({ id: `repo:${style}/${role}/${file}`, style, role, url, name: fontName(file) })
  }
  try {
    const data = await fetch('/api/fonts').then((r) => r.json())
    if (data.ok) {
      for (const f of data.fonts) {
        catalog.push({
          id: `local:${f.style}/${f.role}/${f.file}`,
          style: f.style,
          role: f.role,
          url: `/api/fonts/${encodeURIComponent(f.role)}/${encodeURIComponent(f.style)}/${encodeURIComponent(f.file)}`,
          name: fontName(f.file)
        })
      }
    }
  } catch {
    // Overlay unreachable — the committed set carries the session.
  }
  return catalog
}

// Deal a style that can actually set a card (both roles present), then one
// face per role within it. Returns { style, title, body } or null if the
// catalog can't set type at all.
export function dealTypeFonts(catalog) {
  const styles = [...new Set(catalog.map((f) => f.style))].filter(
    (s) =>
      catalog.some((f) => f.style === s && f.role === 'title') &&
      catalog.some((f) => f.style === s && f.role === 'body')
  )
  if (styles.length === 0) return null
  const style = styles[Math.floor(Math.random() * styles.length)]
  const pick = (role) => {
    const options = catalog.filter((f) => f.style === style && f.role === role)
    return options[Math.floor(Math.random() * options.length)]
  }
  return { style, title: pick('title'), body: pick('body') }
}

const loaded = new Set()

export async function ensureFontLoaded(font) {
  if (loaded.has(font.name)) return
  const face = new FontFace(font.name, `url("${font.url}")`)
  await face.load()
  document.fonts.add(face)
  loaded.add(font.name)
}
