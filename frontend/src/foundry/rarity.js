// Rarity (card_maker.md §5, issue #42): the tier is a hardcoded per-card
// statement of how weird/oblique the card's ACTION is — set at design time
// on the card descriptor (`rarity` in editor/deck.js), not derived from
// copies, deck presence, or print run. The mark is stamped on the cast
// face; the descriptor value rides through the commission as `rarity`.
//
// The mark is small and materially rendered — a punch, not a star rating:
//   singular  a hard diamond punch (by family: the Coda and the Stash Return)
//   scarce    a filled blot, procedurally irregular per cast (strange/oblique)
//   common    the same blot left open — an unfilled ring (legible/everyday)
// Vector Fabric objects, so the Press bakes them crisp at 3×.

import * as fabric from 'fabric'

const INK = '#141414'

// The two singular families: one of each exists at most, and each is a beat
// in the session's structure rather than a modification you can stack.
const SINGULAR_FAMILIES = new Set(['coda', 'stash'])

export function rarityTier(commission) {
  if (SINGULAR_FAMILIES.has(commission.family)) return 'singular'
  return commission.rarity === 'scarce' ? 'scarce' : 'common'
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
