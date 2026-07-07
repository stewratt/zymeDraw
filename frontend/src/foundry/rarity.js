// Rarity (card_maker.md §5): the tier derives from the commission's real
// deck presence — 2 copies = common, 1 = scarce, the Coda = singular
// (tier names are code vocabulary; the mark itself is the only UI). Rarity
// is stamped at casting time, like a print run: if a card's copies later
// change in deck.js, the cast face doesn't retroactively lie.
//
// The mark is small and materially rendered — a punch, not a star rating:
//   singular  a hard diamond punch (the Coda's own class)
//   scarce    a filled blot, procedurally irregular per cast
//   common    the same blot left open — an unfilled ring
// Vector Fabric objects, so the Press bakes them crisp at 3×.

import * as fabric from 'fabric'

const INK = '#141414'

export function rarityTier(commission) {
  if (commission.family === 'coda') return 'singular'
  return commission.copies >= 2 ? 'common' : 'scarce'
}

// The template's rarity home (foundry_card_template.png): a 97×50 box at
// x 598–695, y 962–1012. The mark starts at its center and stays nudgeable
// like every other slot.
const MARK_HOME = { left: 646, top: 987, originX: 'center', originY: 'center' }

function blotPoints(n, radius, jitter) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const r = radius * (1 + (Math.random() * 2 - 1) * jitter)
    return { x: Math.cos(a) * r, y: Math.sin(a) * r }
  })
}

export function makeRarityMark(commission) {
  const tier = rarityTier(commission)
  if (tier === 'singular') {
    return new fabric.Rect({ ...MARK_HOME, width: 28, height: 28, angle: 45, fill: INK })
  }
  const points = blotPoints(20, 16, 0.18)
  if (tier === 'scarce') {
    return new fabric.Polygon(points, { ...MARK_HOME, fill: INK })
  }
  return new fabric.Polygon(points, { ...MARK_HOME, fill: '', stroke: INK, strokeWidth: 4 })
}
