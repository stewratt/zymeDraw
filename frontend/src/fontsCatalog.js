// Font catalog for the dev BG EXPERIMENT switcher (ui-bg-experiment branch).
// This is the file you edit to audition fonts. The `ui font` / `mono font`
// pickers read it. Custom fonts live in frontend/public/fonts/<slug>/ (served
// at /fonts/…, @font-face-loaded from here); system stacks need no files.
// Not a product feature — deletable with the rest of the experiment.

const SANS_FB = 'system-ui, -apple-system, sans-serif'
const SERIF_FB = 'Georgia, "Times New Roman", serif'
const MONO_FB = 'ui-monospace, Menlo, monospace'

// A downloaded family (files under public/fonts/<slug>/<slug>-<weight>.woff2).
//   label = family name (also the @font-face + CSS family); slot = 'ui'|'mono'.
const font = (label, slug, slot, weights, fallback) => ({
  label,
  slot,
  family: label,
  fallback,
  faces: weights.map((weight) => ({ weight, file: `${slug}/${slug}-${weight}.woff2` })),
})

export const FONT_CATALOG = [
  // --- always-available system stacks (index 0 in each slot = shipped
  //     default, so a fresh load changes nothing) ---
  { label: 'System Sans (default)', slot: 'ui', family: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: 'Georgia (serif)', slot: 'ui', family: 'Georgia, "Times New Roman", serif' },
  { label: 'System Mono (default)', slot: 'mono', family: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },

  // --- UI sans (public/fonts/) ---
  font('Inter', 'inter', 'ui', [200, 300, 400], SANS_FB),
  font('Work Sans', 'work-sans', 'ui', [200, 300, 400], SANS_FB),
  font('Space Grotesk', 'space-grotesk', 'ui', [300, 400], SANS_FB),
  font('IBM Plex Sans', 'ibm-plex-sans', 'ui', [200, 300, 400], SANS_FB),
  font('Manrope', 'manrope', 'ui', [200, 300, 400], SANS_FB),
  font('DM Sans', 'dm-sans', 'ui', [300, 400], SANS_FB),
  font('Sora', 'sora', 'ui', [200, 300, 400], SANS_FB),
  font('Archivo', 'archivo', 'ui', [200, 300, 400], SANS_FB),

  // --- UI serif (public/fonts/) ---
  font('Fraunces', 'fraunces', 'ui', [200, 300, 400], SERIF_FB),
  font('EB Garamond', 'eb-garamond', 'ui', [400, 500], SERIF_FB),
  font('Spectral', 'spectral', 'ui', [200, 300, 400], SERIF_FB),
  font('Cormorant', 'cormorant', 'ui', [300, 400], SERIF_FB),

  // --- mono (public/fonts/) ---
  font('JetBrains Mono', 'jetbrains-mono', 'mono', [300, 400], MONO_FB),
  font('Space Mono', 'space-mono', 'mono', [400], MONO_FB),
  font('IBM Plex Mono', 'ibm-plex-mono', 'mono', [300, 400], MONO_FB),
  font('Fira Code', 'fira-code', 'mono', [300, 400], MONO_FB),
  font('DM Mono', 'dm-mono', 'mono', [300, 400], MONO_FB),
]

// The value written into the CSS var: custom fonts get their quoted family +
// fallback; system stacks are used verbatim.
export function fontStack(entry) {
  if (!entry.faces) return entry.family
  return `"${entry.family}", ${entry.fallback || 'sans-serif'}`
}

const FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }
const fmt = (file) => FORMATS[file.split('.').pop()] || 'woff2'

// Inject one <style> of @font-face rules for every custom entry, once per load.
export function ensureFontFaces() {
  if (typeof document === 'undefined' || document.getElementById('experiment-fontfaces')) return
  const rules = FONT_CATALOG.filter((e) => e.faces).flatMap((e) =>
    e.faces.map(
      (f) =>
        `@font-face{font-family:"${e.family}";font-weight:${f.weight || 400};font-style:${f.style || 'normal'};font-display:swap;src:url("/fonts/${f.file}") format("${fmt(f.file)}");}`,
    ),
  )
  if (!rules.length) return
  const style = document.createElement('style')
  style.id = 'experiment-fontfaces'
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}
