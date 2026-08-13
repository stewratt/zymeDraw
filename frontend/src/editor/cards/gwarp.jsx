// Gwarp — the perspective / grid warp (issue #125). A lattice lies over the
// piece; the whole sheet bends to follow it. Fracture's liquid sibling: where
// Fracture breaks the piece into plates that slide on hard 90° seams, nothing
// here is cut, added, coloured or erased — every pixel is still present, only
// moved.
//
// The bending itself is warpMesh.js (the Catmull-Rom surface, the edge-repeat
// skirt, the triangle blit). This file is the session: the overlay the warp is
// drawn into, the lattice you take hold of, and the hooks Editor calls.
//
// Structure is Fracture's: one full-canvas Fabric image over the artboard,
// re-rendered in place when the settings change, left on the canvas at commit
// for the universal bake. The overlay is sized from the MASTER, so the bake
// picks the warp up at full resolution, and scaled by ctx.canvasWidth — never
// canvas.getWidth() — so it also runs unchanged on Foundry's 745×1040
// artboard.
//
// THE LATTICE IS DRAWN, NOT ASSEMBLED. It could have been Fabric lines and
// circles, but that is ~60 objects rebuilt every frame of a drag, and Fabric 6
// Polyline's point/offset handling is a trap worth not walking into. Instead
// it is a second full-canvas image painted with plain 2D calls, exactly like
// the warp beside it: one object, total control over the drawing, no Fabric
// quirks. It is REMOVED at commit, so only the warped piece meets the bake.
//
// PHASE 2 (this commit) adds the handles and the node drag. Grabbing the
// surface between nodes, the grid resample, reset, per-gesture undo and the
// hide key are phase 3.

import * as fabric from 'fabric'
import { createLattice, makePaddedTexture, makeSurface, renderWarp } from '../warpMesh.js'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

export const GRID_MIN = 2
export const GRID_MAX = 5

const GRAB = 14 // screen px within which a press takes hold of a node
const NODE_R = 5 // node handle radius, in artboard units
const LINE_W = 1 // lattice line width, in artboard units
const CURVE_SUB = 6 // samples per cell when drawing a lattice line as a curve

// --- drawing -------------------------------------------------------------

// Paint the lattice into its overlay canvas: the curved cell lines first, then
// the node handles over them. Both are drawn white-under-dark, liftSession's
// marquee trick, so the lattice reads on any ground the piece happens to have.
function paintLattice(s) {
  const c = s.lat.getContext('2d')
  const W = s.lat.width
  const H = s.lat.height
  const k = W / s.w // artboard units → lattice-canvas px (the master scale)
  c.clearRect(0, 0, W, H)

  const surface = makeSurface(s.lattice)
  const N = s.lattice.cells
  const steps = N * CURVE_SUB
  const p = { x: 0, y: 0 }

  // The lines follow the SURFACE, not straight node-to-node segments — the
  // overlay has to show the curve the pixels are actually travelling on, or it
  // would promise a crease the warp doesn't have.
  const lines = []
  for (let i = 0; i <= N; i++) {
    const col = []
    const row = []
    for (let t = 0; t <= steps; t++) {
      surface(i / N, t / steps, p)
      col.push(p.x * W, p.y * H)
      surface(t / steps, i / N, p)
      row.push(p.x * W, p.y * H)
    }
    lines.push(col, row)
  }

  const strokeAll = (color, width) => {
    c.strokeStyle = color
    c.lineWidth = width
    c.beginPath()
    for (const pts of lines) {
      c.moveTo(pts[0], pts[1])
      for (let t = 2; t < pts.length; t += 2) c.lineTo(pts[t], pts[t + 1])
    }
    c.stroke()
  }
  strokeAll('rgba(255,255,255,0.85)', LINE_W * k * 3)
  strokeAll('rgba(17,17,17,0.85)', LINE_W * k)

  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const n = s.lattice.nodes[j * (N + 1) + i]
      const held = s.held && s.held.i === i && s.held.j === j
      c.beginPath()
      c.arc(n.x * W, n.y * H, NODE_R * k * (held ? 1.4 : 1), 0, Math.PI * 2)
      c.fillStyle = held ? '#111111' : 'rgba(255,255,255,0.95)'
      c.fill()
      c.lineWidth = LINE_W * k * 1.5
      c.strokeStyle = held ? 'rgba(255,255,255,0.95)' : 'rgba(17,17,17,0.9)'
      c.stroke()
    }
  }
}

// One full render — the same one during a drag as at rest. An earlier version
// tessellated coarsely while a node was moving and refined on release, but the
// measured cost doesn't justify it: a master-resolution render is 5-15ms at a
// 3× lattice and 13-26ms at 5× (Stew's Mac, 2026-08-13), so full subdivision
// holds 40-75fps mid-drag. Dropping the coarse pass removes the settle-pop on
// release and makes what-you-see-is-what-bakes exact at every instant, which is
// worth more here than the milliseconds.
function render(s) {
  const t = performance.now()
  renderWarp(s.el, s.texture, s.lattice)
  const warped = performance.now()
  paintLattice(s)
  s.img.set('dirty', true)
  s.marks.set('dirty', true)
  s.canvas.requestRenderAll()
  if (import.meta.env.DEV) {
    console.log(
      `[gwarp] ${s.lattice.cells}×: warp ${Math.round(warped - t)}ms, lattice ${Math.round(performance.now() - warped)}ms`
    )
  }
}

// Coalesce a burst of pointer moves into one render per animation frame —
// without this the mesh renders queue up behind the mouse and the drag lags
// further behind the further you go.
function schedule(s) {
  if (s.raf) return
  s.raf = requestAnimationFrame(() => {
    s.raf = null
    render(s)
  })
}

// --- the drag ------------------------------------------------------------

// The node under the pointer, if any. Nodes sit exactly where they were
// dragged (Catmull-Rom interpolates its control points), so a node's hit
// position is simply its own value — no surface evaluation needed. The grab
// radius divides out the zoom so it stays a constant distance ON SCREEN.
function nodeAt(s, p) {
  const N = s.lattice.cells
  const reach = GRAB / (s.canvas.getZoom() || 1)
  let best = null
  let bestD = reach * reach
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const n = s.lattice.nodes[j * (N + 1) + i]
      const dx = n.x * s.w - p.x
      const dy = n.y * s.h - p.y
      const d = dx * dx + dy * dy
      if (d <= bestD) {
        bestD = d
        best = { i, j }
      }
    }
  }
  return best
}

function attach(s) {
  const canvas = s.canvas
  const point = (opt) => opt.scenePoint ?? canvas.getScenePoint(opt.e)

  s.onDown = (opt) => {
    if (canvas.__navPanArmed) return // Space held: a pan is in progress
    const p = point(opt)
    const hit = nodeAt(s, p)
    if (!hit) return
    const n = s.lattice.nodes[hit.j * (s.lattice.cells + 1) + hit.i]
    // Hold the node at its offset from the press, so taking hold of it near
    // the edge of the grab radius doesn't snap it under the cursor.
    s.held = { ...hit, dx: n.x - p.x / s.w, dy: n.y - p.y / s.h }
    paintLattice(s)
    s.marks.set('dirty', true)
    canvas.requestRenderAll()
  }

  s.onMove = (opt) => {
    if (!s.held) return
    const p = point(opt)
    const n = s.lattice.nodes[s.held.j * (s.lattice.cells + 1) + s.held.i]
    n.x = p.x / s.w + s.held.dx
    n.y = p.y / s.h + s.held.dy
    schedule(s)
  }

  s.onUp = () => {
    if (!s.held) return
    s.held = null
    if (s.raf) {
      cancelAnimationFrame(s.raf)
      s.raf = null
    }
    render(s) // once more, to drop the held node's highlight
  }

  canvas.on('mouse:down', s.onDown)
  canvas.on('mouse:move', s.onMove)
  canvas.on('mouse:up', s.onUp)
  s.savedCursor = canvas.defaultCursor
  canvas.defaultCursor = 'crosshair'
}

function detach(s) {
  s.canvas.off('mouse:down', s.onDown)
  s.canvas.off('mouse:move', s.onMove)
  s.canvas.off('mouse:up', s.onUp)
  if (s.raf) {
    cancelAnimationFrame(s.raf)
    s.raf = null
  }
  s.canvas.defaultCursor = s.savedCursor
}

// --- hooks ---------------------------------------------------------------

export function beginGwarp(ctx) {
  const el = document.createElement('canvas')
  el.width = ctx.master.width
  el.height = ctx.master.height
  const lat = document.createElement('canvas')
  lat.width = ctx.master.width
  lat.height = ctx.master.height

  const common = {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: ctx.canvasWidth / el.width,
    scaleY: ctx.canvasHeight / el.height,
    selectable: false,
    evented: false,
    // Both elements are repainted in place, so Fabric must not hold a cached
    // bitmap of either (Ghost and Rails redraw the same way).
    objectCaching: false
  }

  const s = {
    el,
    lat,
    canvas: ctx.canvas,
    w: ctx.canvasWidth,
    h: ctx.canvasHeight,
    img: new fabric.FabricImage(el, common),
    marks: new fabric.FabricImage(lat, common),
    texture: makePaddedTexture(ctx.master),
    lattice: createLattice(ctx.controls.grid),
    held: null,
    raf: null
  }

  // Warp first, lattice over it.
  ctx.canvas.add(s.img)
  ctx.canvas.add(s.marks)
  render(s)
  attach(s)
  return s
}

export function updateGwarp(ctx) {
  const s = ctx.session
  const grid = ctx.controls?.grid
  // Guard the EMPTY controls object, not just a missing session: Editor clears
  // cardControls to {} when a round ends (commitCurrentCard), and that can
  // reach here while this session is still alive. Most cards shrug it off —
  // setting a Fabric prop to undefined is harmless — but this one rebuilds
  // state from the value, and createLattice(undefined) yields cells:undefined,
  // which turns every loop bound into NaN: the render draws nothing while
  // still clearing both overlays, blanking the piece for a frame.
  if (!s || !grid || grid === s.lattice.cells) return
  // Phase 2: changing the density still starts the lattice over. Phase 3 makes
  // this a RESAMPLE — the current surface evaluated at the new node positions
  // — so adding divisions refines a bend instead of throwing it away
  // (Affinity's behaviour).
  s.lattice = createLattice(ctx.controls.grid)
  s.held = null
  render(s)
}

export function commitGwarp(ctx) {
  const s = ctx.session
  if (!s) return
  detach(s)
  // The lattice is scaffolding, not the piece: it comes off before the
  // universal bake. The warped image stays exactly where it is.
  ctx.canvas.remove(s.marks)
  ctx.canvas.requestRenderAll()
}

export function cleanupGwarp(ctx) {
  const s = ctx.session
  if (!s) return
  detach(s)
  ctx.canvas.remove(s.img, s.marks)
  ctx.canvas.requestRenderAll()
}

export function GwarpTools({ controls, ready, onControlChange }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">{CARD_TEXT.gwarp.description}</p>
      <label className="ctrl" title="How many divisions the lattice has — more points, finer control">
        <span className="ctrl-label">Grid</span>
        <input
          type="range"
          min={GRID_MIN}
          max={GRID_MAX}
          value={controls.grid}
          onChange={(e) => onControlChange('grid', Number(e.target.value))}
        />
        <span className="ctrl-value mono">
          {controls.grid}×{controls.grid}
        </span>
      </label>
    </div>
  )
}
