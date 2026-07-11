// The fracture field — the fracture family's engine (cards_plan.md §4). A
// pure pixel function: it reads the master and returns a displaced copy,
// the whole piece broken into voronoi chunks that each slide as a rigid
// block. A clamped-voronoi displacement, the Blender-shader move, made
// local so the hand can carve it back with the mask brush (that composing
// lives in fracture.jsx — this file only bends pixels).
//
// Rigid chunks: feature points sit on a seeded jittered grid at `scale`
// spacing; every pixel belongs to the nearest one (its cell), and a cell's
// whole content is shifted by one constant offset. Hard seams between cells
// — plates sliding, not liquid warp.
//
// Clamped: a cell's shift never exceeds DISP_FRACTION of its own size, so a
// chunk can't wander out of its neighbourhood — displacement rides chunk
// size (bigger chunks slide farther) and stays coherent. Every output pixel
// belongs to some cell, so the field is gapless: a chunk vacating a spot is
// backfilled by whichever cell claims those pixels — no holes to fill.
//
// The nearest-point search checks only the 3×3 grid neighbourhood (jittered-
// grid voronoi), so cost is linear in pixels. Deterministic in `seed`: the
// same seed always yields the same distribution, so the slider explores a
// space rather than re-rolling chaos.

import { MASTER_SCALE } from './masterRaster.js'

const DISP_FRACTION = 0.6 // the clamp: max chunk shift as a fraction of its size

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

// Compute the displaced pixels for `master` at its own resolution. `scale` is
// a display-px chunk size (converted to master px here); `seed` names the
// distribution. Returns an ImageData the caller draws into its source canvas.
export function computeFracture(master, { seed, scale }) {
  const W = master.width
  const H = master.height
  const cell = Math.max(8, Math.round(scale * MASTER_SCALE))

  // Feature points on a jittered grid, plus a per-cell displacement vector.
  // One guard column/row so every pixel's 3×3 neighbourhood is populated.
  const cols = Math.ceil(W / cell) + 1
  const rows = Math.ceil(H / cell) + 1
  const rng = mulberry32(Math.imul(seed + 1, 0x9e3779b1))
  const fx = new Float32Array(cols * rows)
  const fy = new Float32Array(cols * rows)
  const dx = new Float32Array(cols * rows)
  const dy = new Float32Array(cols * rows)
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx
      fx[i] = (gx + rng()) * cell
      fy[i] = (gy + rng()) * cell
      const angle = rng() * Math.PI * 2
      const mag = cell * DISP_FRACTION * rng()
      dx[i] = Math.cos(angle) * mag
      dy[i] = Math.sin(angle) * mag
    }
  }

  const src = master.getContext('2d').getImageData(0, 0, W, H).data
  const out = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const cy = (y / cell) | 0
    for (let x = 0; x < W; x++) {
      const cx = (x / cell) | 0
      // Nearest feature point in the 3×3 neighbourhood decides the cell.
      let best = Infinity
      let bi = 0
      for (let ny = cy - 1; ny <= cy + 1; ny++) {
        if (ny < 0 || ny >= rows) continue
        for (let nx = cx - 1; nx <= cx + 1; nx++) {
          if (nx < 0 || nx >= cols) continue
          const i = ny * cols + nx
          const ddx = x - fx[i]
          const ddy = y - fy[i]
          const d = ddx * ddx + ddy * ddy
          if (d < best) {
            best = d
            bi = i
          }
        }
      }
      // The chunk slides by (dx,dy): show the source from where it came,
      // clamped to the edge so an off-piece read repeats the border.
      let sx = (x - dx[bi]) | 0
      let sy = (y - dy[bi]) | 0
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
