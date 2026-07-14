// Dev-only UI auditioning tool (UI experiment, ui-bg-experiment branch). A
// small fixed panel that drives the --bg / --bg-texture* / --font-ui /
// --font-mono CSS variables live, so the base color, the UItextures grain and
// the UI typefaces can be felt out in the real app without editing files.
// Fonts come from fontsCatalog.js (+ public/fonts/). Not part of the product —
// delete this file, its import in main.jsx, fontsCatalog.js, and the token
// blocks in tokens.css + App.css to revert the whole experiment.

import { useEffect, useState } from 'react'
import { FONT_CATALOG, fontStack, ensureFontFaces } from './fontsCatalog.js'

// The two picker lists, derived from the catalog (index 0 in each = the
// shipped default, so a fresh load changes nothing).
const UI_FONTS = FONT_CATALOG.filter((f) => f.slot === 'ui')
const MONO_FONTS = FONT_CATALOG.filter((f) => f.slot === 'mono')

// Each tile carries the blend mode it reads best at: the light-gray grain
// scans (fabric/paper/speckle) want soft-light against the dark base; the
// transparent dark patterns (dots/grid/hexes) just sit at normal and let the
// purple show through their alpha.
const TEXTURES = [
  { name: 'none', blend: 'normal' },
  { name: 'fabric-1-dark', blend: 'soft-light' },
  { name: 'black-paper', blend: 'multiply' }, // the settled default look (ui_design_notes.md)
  { name: 'otis-redding', blend: 'soft-light' },
  { name: 'dark-dot', blend: 'normal' },
  { name: 'dark-matter', blend: 'normal' },
  { name: 'graphy-dark', blend: 'normal' },
  { name: 'subtle-dots', blend: 'normal' },
  { name: 'hixs-evolution', blend: 'normal' },
  { name: 'blizzard', blend: 'normal' },
]
const BLENDS = ['normal', 'soft-light', 'overlay', 'multiply', 'screen']

const LS_KEY = 'deck.bgExperiment'
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {}
  } catch {
    return {}
  }
}

export default function BgTextureSwitcher() {
  // The settled default look — base #252527 · black-paper · multiply · 0.70
  // (ui_design_notes.md). localStorage still wins once you've touched the
  // panel, so clear it (or the key deck.bgExperiment) to see these fresh.
  const saved = load()
  const [bg, setBg] = useState(saved.bg ?? '#252527')
  const [texIdx, setTexIdx] = useState(saved.texIdx ?? 2) // default: black-paper
  const [blend, setBlend] = useState(saved.blend ?? TEXTURES[saved.texIdx ?? 2].blend)
  const [opacity, setOpacity] = useState(saved.opacity ?? 0.7)
  const [uiIdx, setUiIdx] = useState(saved.uiIdx ?? 0) // default: System Sans
  const [monoIdx, setMonoIdx] = useState(saved.monoIdx ?? 0) // default: System Mono
  const [open, setOpen] = useState(true)

  const tex = TEXTURES[texIdx]
  const uiFont = UI_FONTS[uiIdx] ?? UI_FONTS[0]
  const monoFont = MONO_FONTS[monoIdx] ?? MONO_FONTS[0]

  // Load @font-face rules for any custom catalog entries, once.
  useEffect(() => {
    ensureFontFaces()
  }, [])

  // Push the current look onto the document root, where tokens.css declared
  // the variables — every stylesheet reads them from :root.
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--bg', bg)
    root.setProperty('--bg-texture', tex.name === 'none' ? 'none' : `url('/textures/${tex.name}.png')`)
    root.setProperty('--bg-texture-blend', blend)
    root.setProperty('--bg-texture-opacity', String(opacity))
    root.setProperty('--font-ui', fontStack(uiFont))
    root.setProperty('--font-mono', fontStack(monoFont))
    localStorage.setItem(LS_KEY, JSON.stringify({ bg, texIdx, blend, opacity, uiIdx, monoIdx }))
  }, [bg, texIdx, blend, opacity, tex.name, uiFont, monoFont, uiIdx, monoIdx])

  // Stepping to a new texture snaps blend to that tile's recommended mode; the
  // blend arrows below still let you override afterward.
  const stepTex = (dir) => {
    const next = (texIdx + dir + TEXTURES.length) % TEXTURES.length
    setTexIdx(next)
    setBlend(TEXTURES[next].blend)
  }
  const stepBlend = (dir) => {
    const i = BLENDS.indexOf(blend)
    setBlend(BLENDS[(i + dir + BLENDS.length) % BLENDS.length])
  }
  const stepIdx = (setter, idx, len, dir) => setter((idx + dir + len) % len)

  const panel = {
    position: 'fixed',
    left: 12,
    bottom: 12,
    zIndex: 99999,
    background: 'rgba(10,8,18,0.92)',
    border: '1px solid #3a3450',
    color: '#d8d4e4',
    font: '11px/1.5 ui-monospace, Menlo, monospace',
    padding: open ? '10px 12px' : '6px 10px',
    borderRadius: 4,
    boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
    userSelect: 'none',
    minWidth: open ? 232 : 'auto',
  }
  const row = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }
  const label = { width: 62, color: '#8f88a8', flexShrink: 0 }
  const val = { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const arrow = {
    background: '#241f38',
    border: '1px solid #3a3450',
    color: '#d8d4e4',
    borderRadius: 3,
    padding: '1px 7px',
    cursor: 'pointer',
    font: 'inherit',
  }

  if (!open) {
    return (
      <div style={panel} onClick={() => setOpen(true)} title="Background experiment">
        ● bg
      </div>
    )
  }

  return (
    <div style={panel}>
      <div style={{ ...row, marginTop: 0, justifyContent: 'space-between' }}>
        <strong style={{ letterSpacing: '0.08em', color: '#b9b2d0' }}>BG EXPERIMENT</strong>
        <span style={{ cursor: 'pointer', color: '#8f88a8' }} onClick={() => setOpen(false)} title="Collapse">
          ✕
        </span>
      </div>

      <div style={row}>
        <span style={label}>base</span>
        <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: 26, height: 20, padding: 0, border: 'none', background: 'none' }} />
        <span style={val}>{bg}</span>
      </div>

      <div style={row}>
        <span style={label}>texture</span>
        <button style={arrow} onClick={() => stepTex(-1)}>◀</button>
        <span style={{ ...val, textAlign: 'center' }}>{tex.name}</span>
        <button style={arrow} onClick={() => stepTex(1)}>▶</button>
      </div>

      <div style={row}>
        <span style={label}>blend</span>
        <button style={arrow} onClick={() => stepBlend(-1)}>◀</button>
        <span style={{ ...val, textAlign: 'center' }}>{blend}</span>
        <button style={arrow} onClick={() => stepBlend(1)}>▶</button>
      </div>

      <div style={row}>
        <span style={label}>opacity</span>
        <input type="range" min="0" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ width: 28, textAlign: 'right' }}>{opacity.toFixed(2)}</span>
      </div>

      <div style={{ borderTop: '1px solid #2c2740', marginTop: 8, paddingTop: 2 }} />

      <div style={row}>
        <span style={label}>ui font</span>
        <button style={arrow} onClick={() => stepIdx(setUiIdx, uiIdx, UI_FONTS.length, -1)}>◀</button>
        <span style={{ ...val, textAlign: 'center' }}>{uiFont.label}</span>
        <button style={arrow} onClick={() => stepIdx(setUiIdx, uiIdx, UI_FONTS.length, 1)}>▶</button>
      </div>

      <div style={row}>
        <span style={label}>mono font</span>
        <button style={arrow} onClick={() => stepIdx(setMonoIdx, monoIdx, MONO_FONTS.length, -1)}>◀</button>
        <span style={{ ...val, textAlign: 'center' }}>{monoFont.label}</span>
        <button style={arrow} onClick={() => stepIdx(setMonoIdx, monoIdx, MONO_FONTS.length, 1)}>▶</button>
      </div>
    </div>
  )
}
