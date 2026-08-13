// Checks for warpMesh.js's geometry. Run it directly — no framework, no
// dependency, nothing to install:
//
//   node frontend/src/editor/warpMesh.test.mjs
//
// The repo has no test setup and this file does not add one; it exists because
// the skirt is the one part of the warp that can be wrong WITHOUT LOOKING
// WRONG until the exact gesture that exposes it. It already earned its keep:
// the first skirt extended the sheet along its own tangent, which is right
// along an edge and cancels at a corner, so pulling a corner diagonally inward
// left a hole. Nothing in the visible-at-rest card would have shown that.
//
// Everything asserted here is pure math (no canvas, no DOM), which is why
// warpGeometry is split out from renderWarp.

import {
  createLattice,
  isFlatLattice,
  makeSurface,
  resampleLattice,
  warpGeometry,
  TEXTURE_PAD
} from './warpMesh.js'

let fail = 0
const chk = (name, ok, extra = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${extra ? '   ' + extra : ''}`)
  if (!ok) fail++
}

const W = 2400
const H = 3000
// Stands in for makePaddedTexture's return: the MASTER's extent plus its pad.
const TEX = {
  padX: Math.round(W * TEXTURE_PAD),
  padY: Math.round(H * TEXTURE_PAD),
  width: W,
  height: H
}

// --- the surface ---------------------------------------------------------
console.log('\nsurface')

for (const N of [2, 3, 4, 5]) {
  const S = makeSurface(createLattice(N))
  let worst = 0
  for (let u = 0; u <= 1 + 1e-9; u += 0.017)
    for (let v = 0; v <= 1 + 1e-9; v += 0.019) {
      const p = S(u, v)
      worst = Math.max(worst, Math.abs(p.x - u), Math.abs(p.y - v))
    }
  chk(`identity is the identity map, N=${N}`, worst < 1e-9, `max dev ${worst.toExponential(2)}`)
}

const N = 3
const lat = createLattice(N)
lat.nodes[1 * (N + 1) + 1] = { x: 0.55, y: 0.2 }
const S = makeSurface(lat)
const at = S(1 / N, 1 / N)
chk('a dragged node lands exactly where dragged', Math.abs(at.x - 0.55) < 1e-9 && Math.abs(at.y - 0.2) < 1e-9,
  `(${at.x.toFixed(6)}, ${at.y.toFixed(6)})`)

const near = S(1 / N + 0.05, 1 / N)
const far = S(1, 1)
chk('the neighbourhood bends with it', Math.hypot(near.x - (1 / N + 0.05), near.y - 1 / N) > 0.01,
  `moved ${Math.hypot(near.x - (1 / N + 0.05), near.y - 1 / N).toFixed(4)}`)
chk('the far corner stays put', Math.hypot(far.x - 1, far.y - 1) < 1e-9)

let jump = 0
for (let v = 0; v <= 1; v += 0.01) {
  const a = S(1 / N - 1e-6, v)
  const b = S(1 / N + 1e-6, v)
  jump = Math.max(jump, Math.hypot(a.x - b.x, a.y - b.y))
}
chk('no crease at a cell seam', jump < 1e-5, `max jump ${jump.toExponential(2)}`)

// --- the skirt: does the mesh still cover the artboard? -------------------
// The mesh fills the polygon bounded by its outer ring, so "the artboard is
// inside that ring" IS the no-holes guarantee.
console.log('\nskirt coverage (the bug this suite exists for)')

function outerRing(g) {
  const { M, dx, dy } = g
  const pts = []
  for (let i = 0; i < M; i++) pts.push([dx[i], dy[i]])
  for (let j = 1; j < M; j++) pts.push([dx[j * M + M - 1], dy[j * M + M - 1]])
  for (let i = M - 2; i >= 0; i--) pts.push([dx[(M - 1) * M + i], dy[(M - 1) * M + i]])
  for (let j = M - 2; j >= 1; j--) pts.push([dx[j * M], dy[j * M]])
  return pts
}

function inside(poly, x, y) {
  let c = false
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const [xi, yi] = poly[i]
    const [xk, yk] = poly[k]
    if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) c = !c
  }
  return c
}

function coverage(label, mutate) {
  const l = createLattice(3)
  mutate(l)
  const ring = outerRing(warpGeometry(l, W, H, TEX))
  let uncovered = 0
  const STEP = 40
  for (let y = 1; y < H; y += H / STEP)
    for (let x = 1; x < W; x += W / STEP) if (!inside(ring, x, y)) uncovered++
  chk(label, uncovered === 0, uncovered ? `${uncovered}/${STEP * STEP} artboard samples UNCOVERED` : 'artboard fully covered')
}

coverage('lattice at rest', () => {})
// The exact case that failed with a tangent-extended skirt:
coverage('top-left corner pulled diagonally inward', (l) => {
  l.nodes[0] = { x: 0.18, y: 0.14 }
})
coverage('all four corners pulled in (keystone inward)', (l) => {
  l.nodes[0] = { x: 0.15, y: 0.12 }
  l.nodes[3] = { x: 0.85, y: 0.12 }
  l.nodes[12] = { x: 0.15, y: 0.88 }
  l.nodes[15] = { x: 0.85, y: 0.88 }
})
coverage('one edge midpoint dragged deep inward', (l) => {
  l.nodes[1] = { x: 1 / 3, y: 0.35 }
  l.nodes[2] = { x: 2 / 3, y: 0.35 }
})
coverage('perspective keystone (top edge squeezed)', (l) => {
  l.nodes[0] = { x: 0.25, y: 0.05 }
  l.nodes[3] = { x: 0.75, y: 0.05 }
})
coverage('interior node hauled far off', (l) => {
  l.nodes[5] = { x: 0.9, y: 0.1 }
})

// --- the source mapping --------------------------------------------------
console.log('\nsource mapping')
{
  const g = warpGeometry(createLattice(3), W, H, TEX)
  const { M, sx, sy, dx, dy } = g
  chk('source ring sits at the padded texture edge', Math.abs(sx[0]) < 1e-6 && Math.abs(sy[0]) < 1e-6,
    `(${sx[0].toFixed(3)}, ${sy[0].toFixed(3)})`)
  chk('source sheet corner sits at the master origin',
    Math.abs(sx[M + 1] - TEX.padX) < 1e-6 && Math.abs(sy[M + 1] - TEX.padY) < 1e-6)
  chk('at rest the sheet maps 1:1 onto the artboard',
    Math.abs(dx[M + 1]) < 1e-6 && Math.abs(dy[M + 1]) < 1e-6 &&
      Math.abs(dx[(M - 2) * M + M - 2] - W) < 1e-6 && Math.abs(dy[(M - 2) * M + M - 2] - H) < 1e-6)

  let degenerate = 0
  for (let j = 0; j < M - 1; j++)
    for (let i = 0; i < M - 1; i++) {
      const a = j * M + i
      const b = a + 1
      const d = a + M
      const det = (sx[b] - sx[a]) * (sy[d] - sy[a]) - (sx[d] - sx[a]) * (sy[b] - sy[a])
      if (det === 0) degenerate++
    }
  chk('no zero-area source triangles (the affine solve never divides by 0)', degenerate === 0,
    degenerate ? `${degenerate} degenerate` : '')

  // Source and destination are measured with DIFFERENT rulers: the texture is
  // always the master, the output is whatever it is (the card previews at
  // artboard scale and renders master only at commit). Scaling the source by
  // the output size passes every check above — the two are equal there — and
  // silently samples the master's top-left corner at any other size, which
  // reads on screen as a zoomed piece pinned to that corner. Shipped exactly
  // that way once, on 2026-08-13.
  for (const out of [1, 2, 3]) {
    const g2 = warpGeometry(createLattice(3), W / out, H / out, TEX)
    const { M: M2, sx: s2x, sy: s2y, dx: d2x, dy: d2y } = g2
    const near = M2 + 1 // sheet's first corner
    const farI = (M2 - 2) * M2 + M2 - 2 // …and its last
    chk(`source spans the whole master at 1/${out} output`,
      Math.abs(s2x[near] - TEX.padX) < 1e-6 && Math.abs(s2y[near] - TEX.padY) < 1e-6 &&
        Math.abs(s2x[farI] - (TEX.padX + W)) < 1e-6 && Math.abs(s2y[farI] - (TEX.padY + H)) < 1e-6,
      `sheet reads ${(s2x[farI] - s2x[near]).toFixed(0)}×${(s2y[farI] - s2y[near]).toFixed(0)} of ${W}×${H}`)
    chk(`destination fills the 1/${out} output`,
      Math.abs(d2x[near]) < 1e-6 && Math.abs(d2y[near]) < 1e-6 &&
        Math.abs(d2x[farI] - W / out) < 1e-6 && Math.abs(d2y[farI] - H / out) < 1e-6)
  }

  // What actually ships: a texture built to MATCH the output tier, so every
  // triangle blits about 1:1. A minifying drawImage costs far more per output
  // pixel than a copying one, and there are ~1350 of them per frame — so this
  // ratio being 1 is a performance invariant, not a cosmetic one.
  for (const out of [1, 2, 3]) {
    const tier = {
      padX: Math.round((W / out) * TEXTURE_PAD),
      padY: Math.round((H / out) * TEXTURE_PAD),
      width: W / out,
      height: H / out
    }
    const g3 = warpGeometry(createLattice(3), W / out, H / out, tier)
    const n3 = g3.M + 1
    const f3 = (g3.M - 2) * g3.M + g3.M - 2
    const ratio = (g3.sx[f3] - g3.sx[n3]) / (g3.dx[f3] - g3.dx[n3])
    chk(`a tier-matched texture blits 1:1 at 1/${out}`, Math.abs(ratio - 1) < 1e-9,
      `source:dest = ${ratio.toFixed(4)}`)
  }
}

// --- resample (the grid control refines a bend, never discards it) --------
console.log('\nresample')
{
  chk('same density is a no-op', resampleLattice(lat, 3) === lat)

  const flat = resampleLattice(createLattice(3), 5)
  chk('a flat lattice resamples flat', isFlatLattice(flat))
  chk('isFlatLattice sees a bent one', !isFlatLattice(lat))

  // Every new node must land where the OLD surface already was.
  const fine = resampleLattice(lat, 5)
  const before = makeSurface(lat)
  let worst = 0
  for (let j = 0; j <= 5; j++)
    for (let i = 0; i <= 5; i++) {
      const want = before(i / 5, j / 5)
      const got = fine.nodes[j * 6 + i]
      worst = Math.max(worst, Math.hypot(got.x - want.x, got.y - want.y))
    }
  chk('resampled nodes sit on the previous surface', worst < 1e-12, `max dev ${worst.toExponential(2)}`)

  // A resample re-fits the surface rather than reproducing it, so some of the
  // gesture is always lost. How much is worth pinning down, because the two
  // directions are NOT alike: refining costs ~11% of the displacement, while
  // coarsening costs ~80% — a 2× lattice has nodes only at 0, 0.5 and 1, so a
  // bend sitting at a 3× interior node has nowhere to live. That asymmetry is
  // the honest limit of the control, not a bug to fix.
  const driftOf = (a, b) => {
    const A = makeSurface(a)
    const B = makeSurface(b)
    let m = 0
    for (let v = 0; v <= 1; v += 0.02)
      for (let u = 0; u <= 1; u += 0.02) {
        const p = A(u, v)
        const q = B(u, v)
        m = Math.max(m, Math.hypot(p.x - q.x, p.y - q.y))
      }
    return m
  }
  const D = 0.22 // how far the node is dragged, in normalized units
  const bent = createLattice(3)
  bent.nodes[5] = { x: 1 / 3 + D, y: 1 / 3 }
  const up = driftOf(bent, resampleLattice(bent, 5))
  const down = driftOf(bent, resampleLattice(bent, 2))
  chk('refining keeps most of the bend', up < D * 0.15, `drift ${up.toFixed(4)} on a ${D} drag`)
  chk('coarsening loses more than refining, as it must', down > up * 3, `drift ${down.toFixed(4)}`)
  chk('drift scales with the gesture, not the canvas', (() => {
    const small = createLattice(3)
    small.nodes[5] = { x: 1 / 3 + D / 4, y: 1 / 3 }
    return driftOf(small, resampleLattice(small, 5)) < up * 0.4
  })())

  const still = resampleLattice(fine, 3)
  chk('coverage holds after a resample', (() => {
    const ring = outerRing(warpGeometry(still, W, H, TEX))
    for (let y = 1; y < H; y += H / 20)
      for (let x = 1; x < W; x += W / 20) if (!inside(ring, x, y)) return false
    return true
  })())
}

console.log(fail ? `\n${fail} FAILED\n` : '\nall checks passed\n')
process.exit(fail ? 1 : 0)
