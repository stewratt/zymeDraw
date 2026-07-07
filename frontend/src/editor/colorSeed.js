// The random-hue invariant (CLAUDE.md §7), extracted from Editor.jsx so
// Foundry seeds dealt cards identically: any control named `color` starts
// on a fresh random hue each deal — a color card should never open on the
// same swatch twice (its registry default is just a placeholder). Random
// hue at fixed saturation/lightness keeps the picks vivid rather than muddy.

export function randomHexColor() {
  const h = Math.floor(Math.random() * 360)
  const s = 0.65
  const l = 0.55
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x]
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export function randomizeColors(defaults) {
  const out = { ...defaults }
  for (const key of Object.keys(out)) {
    if (key === 'color') out[key] = randomHexColor()
  }
  return out
}
