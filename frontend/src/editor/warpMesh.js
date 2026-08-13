// The warp mesh — Gwarp's engine (issue #125). A pure geometry + rendering
// module: it reads a master and a control lattice and draws the bent sheet
// into an output canvas. No Fabric, no DOM events, no React — the same split
// fractureField.js has from fracture.jsx. This file only bends pixels; the
// lattice's handles, drags and undo live in cards/gwarp.jsx.
//
// Fracture's seams are hard 90° plates. This is its liquid sibling: one
// continuous sheet, every pixel still present, only moved.
//
// HOW A WARP IS DRAWN. Canvas 2D has no "draw this image warped" call, so we
// use the standard triangle texture-mapping technique: cut the destination
// into many small triangles, and for each one clip to it, set the affine
// transform that carries its SOURCE triangle onto its DESTINATION triangle,
// and drawImage through that. Three point-pairs determine an affine exactly,
// which is why the mesh is triangles and not quads.
//
// THE SURFACE. The lattice is (N+1)² control nodes, but the sheet bends as a
// bicubic Catmull-Rom patch over them — so dragging ONE node curves its whole
// neighbourhood instead of creasing at it. That smoothness is the card
// (Photoshop Warp / Affinity Mesh Warp behave this way); a straight bilinear
// lattice would just look like Fracture with the seams stretched. Catmull-Rom
// needs a ring of control points outside the lattice, which buildExtended
// supplies by linear extrapolation, so the curve is defined right to the edge.
//
// THE EDGE — TWO SEPARATE THINGS. Corners move (Stew, 2026-08-12), so an
// inward pull would leave the artboard uncovered. The answer is edge-repeat,
// the same promise fractureField.js makes when a tile's shift reads off-piece,
// and it takes a pair of measures that are easy to confuse:
//
//   TEXTURE_PAD (source side) — the master is copied into a slightly larger
//   canvas whose border is the outermost row/column stretched outward. This is
//   what gives the skirt real pixels to read. Padding the texture, rather than
//   special-casing the boundary triangles, keeps the source mapping a single
//   uniform affine function of (u,v) everywhere, with no zero-area source
//   triangles to make the solve blow up.
//
//   SKIRT (destination side) — how far past the sheet the outer ring of quads
//   reaches. It is FREE (geometry, not memory), so it is generous: a whole
//   canvas of smear, which no plausible pull can outrun.
//
// The outer ring extends along each edge's OUTWARD PERPENDICULAR NORMAL, not
// along the surface's own tangent. That distinction is load-bearing and cost a
// bug: a tangent extension is correct along an edge but cancels at a corner —
// pull the top-left corner diagonally inward and the u-extension goes
// left-and-down while the v-extension goes right-and-up, so their sum lands
// back INSIDE the artboard and the hole reappears. The perpendicular normals
// at that same corner both point up-left and reinforce instead. Their
// direction is fixed per edge by the map's orientation (see ringOffset), not
// chosen by a dot-product test, which goes numerically delicate exactly when
// two edges run near-parallel.
//
// COORDINATES. Lattice nodes are NORMALIZED (0..1), never pixels: the same
// lattice then renders at proxy or master resolution, and on Deck's 800×1000
// artboard or Foundry's 745×1040, with no conversion.

// Source-side padding, as a fraction of each side. Only needs to be thick
// enough to sample cleanly — the skirt stretches it as far as it likes. 0.1
// keeps the padded texture well under every browser's canvas-area cap
// (Deck: 2880×3600 ≈ 10.4 Mpx; Safari's historic limit is 16.7 Mpx).
export const TEXTURE_PAD = 0.1

// Destination-side reach of the outer ring, in normalized units — one whole
// canvas of edge smear past the sheet, so even an extreme pull stays covered.
const SKIRT = 1

// Fine steps per lattice cell across the sheet. The skirt gets one step per
// side — its extension is linear, so subdividing it would buy nothing.
const SUB = 8

// Dest triangles are drawn this many pixels oversize, pushed out from their
// centroid, so neighbours overlap. Without it every shared edge shows a
// hairline: clip() antialiases, and two abutting half-covered edges do not
// add back up to one opaque pixel. This is THE artifact of the technique.
const EXPAND = 0.5

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

// A lattice at rest: (cells+1)² nodes on a uniform normalized grid.
export function createLattice(cells) {
  const nodes = []
  for (let j = 0; j <= cells; j++) {
    for (let i = 0; i <= cells; i++) nodes.push({ x: i / cells, y: j / cells })
  }
  return { cells, nodes }
}

// The control grid with one extrapolated ring around it, flattened to
// [x,y,x,y,…] of side cells+3. Catmull-Rom reads one node beyond each end, so
// without this ring the outermost cells could not be evaluated. Linear
// extrapolation (P₋₁ = 2P₀ − P₁) continues the sheet's own slope, which is why
// the surface stays smooth right up to the boundary instead of flattening
// into it. Rows are filled first, then columns across the FULL width — that
// second pass fills the four corners as a side effect.
function buildExtended(lattice) {
  const N = lattice.cells
  const S = N + 3
  const E = new Float64Array(S * S * 2)
  const at = (i, j) => (j * S + i) * 2

  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const n = lattice.nodes[j * (N + 1) + i]
      const o = at(i + 1, j + 1)
      E[o] = n.x
      E[o + 1] = n.y
    }
  }
  for (let j = 1; j <= N + 1; j++) {
    const l0 = at(1, j)
    const l1 = at(2, j)
    const lo = at(0, j)
    E[lo] = 2 * E[l0] - E[l1]
    E[lo + 1] = 2 * E[l0 + 1] - E[l1 + 1]
    const r0 = at(N + 1, j)
    const r1 = at(N, j)
    const ro = at(N + 2, j)
    E[ro] = 2 * E[r0] - E[r1]
    E[ro + 1] = 2 * E[r0 + 1] - E[r1 + 1]
  }
  for (let i = 0; i <= N + 2; i++) {
    const t0 = at(i, 1)
    const t1 = at(i, 2)
    const to = at(i, 0)
    E[to] = 2 * E[t0] - E[t1]
    E[to + 1] = 2 * E[t0 + 1] - E[t1 + 1]
    const b0 = at(i, N + 1)
    const b1 = at(i, N)
    const bo = at(i, N + 2)
    E[bo] = 2 * E[b0] - E[b1]
    E[bo + 1] = 2 * E[b0 + 1] - E[b1 + 1]
  }
  return { E, S }
}

// The uniform Catmull-Rom basis. Passes through p1 at t=0 and p2 at t=1, with
// tangents taken from the neighbours — so the sheet interpolates its control
// nodes exactly (a node sits where you dragged it) rather than approximating.
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

// The patch at (u,v) ∈ [0,1]²: interpolate four rows across u, then those
// four results across v.
function patch(ext, N, u, v, out) {
  const { E, S } = ext
  const fu = u * N
  const fv = v * N
  let i0 = Math.floor(fu)
  let j0 = Math.floor(fv)
  if (i0 < 0) i0 = 0
  else if (i0 > N - 1) i0 = N - 1
  if (j0 < 0) j0 = 0
  else if (j0 > N - 1) j0 = N - 1
  const tu = fu - i0
  const tv = fv - j0

  let x0 = 0
  let x1 = 0
  let x2 = 0
  let x3 = 0
  let y0 = 0
  let y1 = 0
  let y2 = 0
  let y3 = 0
  for (let k = 0; k < 4; k++) {
    const b = (j0 + k) * S + i0
    const a0 = b * 2
    const a1 = (b + 1) * 2
    const a2 = (b + 2) * 2
    const a3 = (b + 3) * 2
    const rx = cr(E[a0], E[a1], E[a2], E[a3], tu)
    const ry = cr(E[a0 + 1], E[a1 + 1], E[a2 + 1], E[a3 + 1], tu)
    if (k === 0) {
      x0 = rx
      y0 = ry
    } else if (k === 1) {
      x1 = rx
      y1 = ry
    } else if (k === 2) {
      x2 = rx
      y2 = ry
    } else {
      x3 = rx
      y3 = ry
    }
  }
  out.x = cr(x0, x1, x2, x3, tv)
  out.y = cr(y0, y1, y2, y3, tv)
  return out
}

// A reusable evaluator for one lattice: (u,v) → normalized destination, over
// the sheet itself. gwarp.jsx draws the lattice's curved lines through this,
// so the overlay shows the same surface the pixels are travelling on. Samples
// outside [0,1]² clamp to the boundary; the skirt past it is renderWarp's job,
// because it is built from edge normals rather than from the patch.
export function makeSurface(lattice) {
  const ext = buildExtended(lattice)
  const N = lattice.cells
  return (u, v, out = { x: 0, y: 0 }) => patch(ext, N, clamp01(u), clamp01(v), out)
}

// The master with an edge-repeat border, so the mesh has real pixels to read
// wherever the sheet is pulled inward. Built once per session (the master
// doesn't change mid-card) and handed to every render.
export function makePaddedTexture(master) {
  const W = master.width
  const H = master.height
  const padX = Math.round(W * TEXTURE_PAD)
  const padY = Math.round(H * TEXTURE_PAD)
  const el = document.createElement('canvas')
  el.width = W + padX * 2
  el.height = H + padY * 2
  const c = el.getContext('2d')
  c.drawImage(master, padX, padY)
  // Four sides from the outermost row/column, then four corners from the
  // corner pixels — the standard clamp-to-edge, done once with drawImage
  // stretches rather than per-pixel.
  c.drawImage(master, 0, 0, 1, H, 0, padY, padX, H)
  c.drawImage(master, W - 1, 0, 1, H, padX + W, padY, padX, H)
  c.drawImage(master, 0, 0, W, 1, padX, 0, W, padY)
  c.drawImage(master, 0, H - 1, W, 1, padX, padY + H, W, padY)
  c.drawImage(master, 0, 0, 1, 1, 0, 0, padX, padY)
  c.drawImage(master, W - 1, 0, 1, 1, padX + W, 0, padX, padY)
  c.drawImage(master, 0, H - 1, 1, 1, 0, padY + H, padX, padY)
  c.drawImage(master, W - 1, H - 1, 1, 1, padX + W, padY + H, padX, padY)
  return { canvas: el, padX, padY }
}

// One textured triangle. `s*` index the source vertices, `d*` the destination
// ones; both are flat arrays so the hot loop allocates nothing.
function drawTri(c, tex, sx, sy, dx, dy, i0, i1, i2) {
  const x1 = sx[i0]
  const y1 = sy[i0]
  const x2 = sx[i1]
  const y2 = sy[i1]
  const x3 = sx[i2]
  const y3 = sy[i2]
  const det = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)
  if (det === 0) return

  const u1 = dx[i0]
  const v1 = dy[i0]
  const u2 = dx[i1]
  const v2 = dy[i1]
  const u3 = dx[i2]
  const v3 = dy[i2]

  // Cramer's rule for the affine carrying (x,y) → (u,v) at all three corners.
  const w1 = x2 * y3 - x3 * y2
  const w2 = x3 * y1 - x1 * y3
  const w3 = x1 * y2 - x2 * y1
  const ma = (u1 * (y2 - y3) + u2 * (y3 - y1) + u3 * (y1 - y2)) / det
  const mc = (u1 * (x3 - x2) + u2 * (x1 - x3) + u3 * (x2 - x1)) / det
  const me = (u1 * w1 + u2 * w2 + u3 * w3) / det
  const mb = (v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / det
  const md = (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / det
  const mf = (v1 * w1 + v2 * w2 + v3 * w3) / det

  // Clip to the OVERSIZE destination triangle while keeping the transform the
  // exact one above: the expansion is a mask allowance, not a change of
  // mapping, so neighbours overlap by a hair and no seam shows.
  const gx = (u1 + u2 + u3) / 3
  const gy = (v1 + v2 + v3) / 3
  c.save()
  c.beginPath()
  let px = u1 - gx
  let py = v1 - gy
  let l = Math.hypot(px, py) || 1
  c.moveTo(u1 + (px / l) * EXPAND, v1 + (py / l) * EXPAND)
  px = u2 - gx
  py = v2 - gy
  l = Math.hypot(px, py) || 1
  c.lineTo(u2 + (px / l) * EXPAND, v2 + (py / l) * EXPAND)
  px = u3 - gx
  py = v3 - gy
  l = Math.hypot(px, py) || 1
  c.lineTo(u3 + (px / l) * EXPAND, v3 + (py / l) * EXPAND)
  c.closePath()
  c.clip()
  c.transform(ma, mb, mc, md, me, mf)

  // Blit only this triangle's source box, not the whole texture: the clip
  // would discard the rest anyway, and at master resolution the texture is
  // ~10 megapixels being asked for a thousand times.
  const bx = Math.max(0, Math.floor(Math.min(x1, x2, x3)) - 1)
  const by = Math.max(0, Math.floor(Math.min(y1, y2, y3)) - 1)
  const bw = Math.min(tex.width, Math.ceil(Math.max(x1, x2, x3)) + 1) - bx
  const bh = Math.min(tex.height, Math.ceil(Math.max(y1, y2, y3)) + 1) - by
  if (bw > 0 && bh > 0) c.drawImage(tex, bx, by, bw, bh, bx, by, bw, bh)
  c.restore()
}

// One edge sample's outward offset. `cw` names the quarter-turn that carries
// that edge's tangent to its outward normal. The rotations are fixed by the
// map's orientation, checked against identity in screen coords (y down):
//   top    tangent dS/du = (1,0)  → outward (0,-1) = up    → (T.y, -T.x)
//   bottom tangent dS/du = (1,0)  → outward (0, 1) = down  → (-T.y, T.x)
//   left   tangent dS/dv = (0,1)  → outward (-1,0) = left  → (-T.y, T.x)
//   right  tangent dS/dv = (0,1)  → outward ( 1,0) = right → (T.y, -T.x)
function ringOffset(tx, ty, cw, out) {
  const nx = cw ? ty : -ty
  const ny = cw ? -tx : tx
  const l = Math.hypot(nx, ny)
  if (!l) {
    out.x = 0
    out.y = 0
    return out
  }
  out.x = (nx / l) * SKIRT
  out.y = (ny / l) * SKIRT
  return out
}

// The mesh for one lattice at one output size: matched source and destination
// vertex grids, side M, as flat arrays. Split out from the drawing so it is
// pure — no canvas, no DOM — and can be checked directly. The skirt's geometry
// is the subtle part of this file and was wrong once; it is worth being able
// to assert on rather than only look at.
//
// The grid is the fine sheet with ONE ring of skirt quads around it: the
// skirt's extension is straight, so subdividing it would buy nothing.
export function warpGeometry(lattice, W, H, texture, { sub = SUB } = {}) {
  const N = lattice.cells
  const surface = makeSurface(lattice)

  const steps = N * sub
  const K = steps + 1 // sheet samples per axis
  const M = K + 2 // …plus the skirt ring

  // Source stays the plain uniform map over [-TEXTURE_PAD, 1+TEXTURE_PAD] —
  // this is what padding the texture bought us.
  const ts = [-TEXTURE_PAD]
  for (let k = 0; k <= steps; k++) ts.push(k / steps)
  ts.push(1 + TEXTURE_PAD)

  const dx = new Float64Array(M * M)
  const dy = new Float64Array(M * M)
  const sx = new Float64Array(M * M)
  const sy = new Float64Array(M * M)
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < M; i++) {
      const k = j * M + i
      sx[k] = texture.padX + ts[i] * W
      sy[k] = texture.padY + ts[j] * H
    }
  }

  // The sheet, into the interior of the grid.
  const p = { x: 0, y: 0 }
  for (let b = 0; b < K; b++) {
    for (let a = 0; a < K; a++) {
      surface(a / steps, b / steps, p)
      const k = (b + 1) * M + (a + 1)
      dx[k] = p.x * W
      dy[k] = p.y * H
    }
  }

  // The skirt ring, offset from the boundary along its outward normal.
  // Tangents come from the sheet vertices just computed, by central difference
  // where there is room for one.
  const off = { x: 0, y: 0 }
  const inner = (a, b) => (b + 1) * M + (a + 1)
  const near = (i) => (i < 1 ? 0 : i > K - 2 ? K - 2 : i - 1)
  for (let a = 0; a < K; a++) {
    const i0 = near(a)
    const i1 = i0 + 1
    // top
    let t0 = inner(i0, 0)
    let t1 = inner(i1, 0)
    ringOffset(dx[t1] - dx[t0], dy[t1] - dy[t0], true, off)
    let k = inner(a, 0)
    dx[a + 1] = dx[k] + off.x * W
    dy[a + 1] = dy[k] + off.y * H
    // bottom
    t0 = inner(i0, K - 1)
    t1 = inner(i1, K - 1)
    ringOffset(dx[t1] - dx[t0], dy[t1] - dy[t0], false, off)
    k = inner(a, K - 1)
    dx[(M - 1) * M + a + 1] = dx[k] + off.x * W
    dy[(M - 1) * M + a + 1] = dy[k] + off.y * H
  }
  for (let b = 0; b < K; b++) {
    const j0 = near(b)
    const j1 = j0 + 1
    // left
    let t0 = inner(0, j0)
    let t1 = inner(0, j1)
    ringOffset(dx[t1] - dx[t0], dy[t1] - dy[t0], false, off)
    let k = inner(0, b)
    dx[(b + 1) * M] = dx[k] + off.x * W
    dy[(b + 1) * M] = dy[k] + off.y * H
    // right
    t0 = inner(K - 1, j0)
    t1 = inner(K - 1, j1)
    ringOffset(dx[t1] - dx[t0], dy[t1] - dy[t0], true, off)
    k = inner(K - 1, b)
    dx[(b + 1) * M + M - 1] = dx[k] + off.x * W
    dy[(b + 1) * M + M - 1] = dy[k] + off.y * H
  }
  // Corners take BOTH of their edges' offsets — corner = sheet + offsetA +
  // offsetB, read back off the two ring neighbours already written. This is
  // where normals earn their keep: at a corner pulled diagonally inward two
  // normals reinforce, where two tangents would cancel and re-enter the sheet.
  const corner = (at, ringA, ringB, sheet) => {
    dx[at] = dx[ringA] + dx[ringB] - dx[sheet]
    dy[at] = dy[ringA] + dy[ringB] - dy[sheet]
  }
  corner(0, 1, M, inner(0, 0))
  corner(M - 1, M - 2, 2 * M - 1, inner(K - 1, 0))
  corner((M - 1) * M, (M - 1) * M + 1, (M - 2) * M, inner(0, K - 1))
  corner((M - 1) * M + M - 1, (M - 1) * M + M - 2, (M - 2) * M + M - 1, inner(K - 1, K - 1))

  return { M, dx, dy, sx, sy }
}

// Draw the sheet as bent by `lattice` into `out`, at whatever resolution `out`
// happens to be.
export function renderWarp(out, texture, lattice, opts) {
  const W = out.width
  const H = out.height
  const { M, dx, dy, sx, sy } = warpGeometry(lattice, W, H, texture, opts)

  const c = out.getContext('2d')
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, W, H)
  for (let j = 0; j < M - 1; j++) {
    for (let i = 0; i < M - 1; i++) {
      const a = j * M + i
      const b = a + 1
      const d = a + M
      const e = d + 1
      drawTri(c, texture.canvas, sx, sy, dx, dy, a, b, d)
      drawTri(c, texture.canvas, sx, sy, dx, dy, b, e, d)
    }
  }
  return out
}
