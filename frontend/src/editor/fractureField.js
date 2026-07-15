// The fracture field — the fracture family's engine (cards_plan.md §4). A
// pure pixel function: it reads the master and returns a displaced copy,
// the whole piece broken into rectangular tiles that each slide as a rigid
// block. A clamped grid displacement, made local so the hand can carve it
// back with the mask brush (that composing lives in fracture.jsx — this
// file only bends pixels).
//
// Grid, not voronoi: the piece is cut by full-span straight seams. First
// horizontal bands split the height at jittered rows; then each band is
// split into columns at its own jittered widths — so vertical seams offset
// from band to band (a brick/Mondrian break, not a rigid checkerboard).
// Every tile is an axis-aligned rectangle whose whole content shifts by one
// constant offset. Hard 90° seams — plates sliding, not liquid warp.
//
// Clamped: a tile's shift never exceeds DISP_FRACTION of its own shorter
// side, so a tile can't wander out of its neighbourhood — displacement
// rides tile size (bigger tiles slide farther) and stays coherent. Every
// output pixel belongs to some tile, so the field is gapless: a tile
// vacating a spot is backfilled by whichever tile claims those pixels — no
// holes to fill.
//
// Boundary jitter is bounded to < half the base spacing, so seams stay
// strictly ordered without any sort. Lookup is O(1) per pixel via precomputed
// row/column maps, so cost is linear in pixels. Deterministic in `seed`: the
// same seed always yields the same distribution, so the slider explores a
// space rather than re-rolling chaos.

import { MASTER_SCALE } from './masterRaster.js'

const DISP_FRACTION = 0.6 // the clamp: max tile shift as a fraction of its shorter side
const JITTER = 0.7 // seam wander as a fraction of base spacing (kept < 1 → seams stay ordered)

// Small deterministic PRNG (mulberry32) — seeded so a `seed` value names a
// fixed distribution.
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Jittered full-span boundaries: `n` cells spanning `extent`, base spacing
// `extent/n`, each interior seam nudged by up to ±JITTER/2 of the spacing.
// The bound keeps seams strictly increasing without a sort. Returns the n+1
// boundary positions (first 0, last `extent`).
function seams(n, extent, rng) {
  const b = new Float32Array(n + 1)
  const spacing = extent / n
  b[0] = 0
  b[n] = extent
  for (let i = 1; i < n; i++) b[i] = i * spacing + (rng() - 0.5) * JITTER * spacing
  return b
}

// Compute the displaced pixels for `master` at its own resolution. `scale` is
// a display-px tile size (converted to master px here); `seed` names the
// distribution. Returns an ImageData the caller draws into its source canvas.
export function computeFracture(master, { seed, scale }) {
  const W = master.width
  const H = master.height
  const cell = Math.max(8, Math.round(scale * MASTER_SCALE))
  const rng = mulberry32(Math.imul(seed + 1, 0x9e3779b1))

  // Horizontal bands split the height; each band then splits into its own
  // columns. Every tile gets a displacement vector clamped to its shorter
  // side. rowOf/colOf are per-pixel lookup maps so the pixel loop is O(1).
  const nRows = Math.max(1, Math.round(H / cell))
  const rowY = seams(nRows, H, rng)
  const rowOf = new Int16Array(H)
  for (let y = 0, r = 0; y < H; y++) {
    while (r < nRows - 1 && y >= rowY[r + 1]) r++
    rowOf[y] = r
  }

  // Per band: column seams, a per-x column map, and the tiles' displacements.
  const bands = new Array(nRows)
  for (let r = 0; r < nRows; r++) {
    const bandH = rowY[r + 1] - rowY[r]
    const nCols = Math.max(1, Math.round(W / cell))
    const colX = seams(nCols, W, rng)
    const colOf = new Int16Array(W)
    const dx = new Float32Array(nCols)
    const dy = new Float32Array(nCols)
    for (let x = 0, c = 0; x < W; x++) {
      while (c < nCols - 1 && x >= colX[c + 1]) c++
      colOf[x] = c
    }
    for (let c = 0; c < nCols; c++) {
      const tileW = colX[c + 1] - colX[c]
      const angle = rng() * Math.PI * 2
      const mag = Math.min(tileW, bandH) * DISP_FRACTION * rng()
      dx[c] = Math.cos(angle) * mag
      dy[c] = Math.sin(angle) * mag
    }
    bands[r] = { colOf, dx, dy }
  }

  const src = master.getContext('2d').getImageData(0, 0, W, H).data
  const out = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const band = bands[rowOf[y]]
    const { colOf, dx, dy } = band
    for (let x = 0; x < W; x++) {
      const c = colOf[x]
      // The tile slides by (dx,dy): show the source from where it came,
      // clamped to the edge so an off-piece read repeats the border.
      let sx = (x - dx[c]) | 0
      let sy = (y - dy[c]) | 0
      if (sx < 0) sx = 0
      else if (sx >= W) sx = W - 1
      if (sy < 0) sy = 0
      else if (sy >= H) sy = H - 1
      const s = (sy * W + sx) * 4
      const o = (y * W + x) * 4
      out[o] = src[s]
      out[o + 1] = src[s + 1]
      out[o + 2] = src[s + 2]
      out[o + 3] = src[s + 3]
    }
  }

  return new ImageData(out, W, H)
}
