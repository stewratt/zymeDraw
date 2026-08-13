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
// WHAT YOU LOOK AT IS A PROXY. Only ONE render in the whole session has to be
// exact — the one at commit, because it is the one that bakes. Everything
// before it is going to be scaled down to the artboard by Fabric on its way to
// the screen, so rendering it at master resolution means drawing 7.2 megapixels
// and discarding eight ninths of them, every frame, twice (the lattice too).
// So the overlays are artboard-scale here and the master is rendered once, in
// commit. Deck already works this way at large — masterRaster's whole premise
// is that the visible canvas is a scaled proxy of the true pixels.
//
// TWO GRIPS, ONE GESTURE. Press on a node to move that node; press anywhere
// else to take the cell under the pointer and move its four corners together
// (Photoshop's grab-the-surface). Nodes win inside the grab radius, so the
// finer control is always the one nearest to hand.
//
// UNDO IS PER GESTURE, and the lattice is the whole of the card's state — so a
// step is just a snapshot of the nodes, not a replay. Lift set the precedent
// that a gesture engine gets within-card undo; card_anatomy §7's "brushes
// only" predates it. Nothing survives End, as ever.

import * as fabric from 'fabric'
import {
  createLattice,
  isFlatLattice,
  makePaddedTexture,
  makeSurface,
  renderWarp,
  resampleLattice
} from '../warpMesh.js'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

export const GRID_MIN = 2
export const GRID_MAX = 5

const GRAB = 14 // screen px within which a press takes hold of a node
const NODE_R = 5 // node handle radius, in artboard units
const LINE_W = 1 // lattice line width, in artboard units
const CURVE_SUB = 6 // samples per cell when drawing a lattice line as a curve
const FIND_SUB = 4 // samples per cell when searching for the cell under a press

// Preview resolution, as a multiple of the artboard (the bake is always
// MASTER_SCALE = 3× regardless). Two tiers, because the two states want
// different things: at rest you are LOOKING at the piece, so it should hold up
// when zoomed in; mid-drag you are steering it, and frame rate is worth more
// than sharpness. Release re-renders at VIEW_IDLE — a sharpen, not a change of
// shape, so nothing shifts under the cursor the way a coarser TESSELLATION
// would have. That is why the resolution moves and the subdivision doesn't.
const VIEW_IDLE = 2
const VIEW_DRAG = 1

// The lattice is scaffolding — commit removes it before the bake, so it is
// only ever looked at, and 2× artboard draws it exactly as crisply as master
// did (paintLattice scales every width by k, so the picture is unchanged).
const VIEW_MARKS = 2

// --- lattice state -------------------------------------------------------

const snapshot = (l) => ({ cells: l.cells, nodes: l.nodes.map((n) => ({ x: n.x, y: n.y })) })

function notify(s) {
  s.report({ canUndo: s.past.length > 0, canRedo: s.future.length > 0 })
}

function commitGesture(s, before) {
  s.past.push(before)
  s.future = []
  notify(s)
}

// Undo/redo may cross a grid change, which would leave the slider reading a
// density the lattice no longer has — so the control is pushed back into
// Editor to match. That write lands in `update`, where the guard sees the two
// already agree and does nothing.
function syncGrid(s) {
  if (s.lattice.cells !== s.grid) {
    s.grid = s.lattice.cells
    s.setControl('grid', s.lattice.cells)
  }
}

function step(s, from, to) {
  if (s.held || !from.length) return
  to.push(snapshot(s.lattice))
  s.lattice = from.pop()
  syncGrid(s)
  render(s)
  notify(s)
}

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
      const held = s.held?.kind === 'node' && s.held.i === i && s.held.j === j
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

// Point the warp image at a different canvas. Fabric 6's setElement re-reads
// width/height from the element (and skips the filter path, since there are
// none), so the seat only has to be re-scaled to keep filling the artboard.
function mount(s, el) {
  s.view = el
  s.img.setElement(el)
  s.img.set({ scaleX: s.w / el.width, scaleY: s.h / el.height, dirty: true })
  // The on-screen box is the artboard at every tier, so the coords don't
  // actually move — but Fabric culls offscreen objects from its own cached
  // coords, and leaving them stale after an element swap is how that goes
  // wrong later.
  s.img.setCoords()
}

// The padded texture matched to an output size, built once each and kept. A
// texture is a few megapixels; there are at most three.
function textureFor(s, el) {
  let tex = s.textures.get(el.width)
  if (!tex) {
    tex = makePaddedTexture(s.master, el.width / s.master.width)
    s.textures.set(el.width, tex)
  }
  return tex
}

// The warp, into whichever tier the current state calls for.
function paintWarp(s) {
  const want = s.held ? s.fast : s.fine
  if (want !== s.view) mount(s, want)
  renderWarp(s.view, textureFor(s, s.view), s.lattice)
  s.img.set('dirty', true)
}

function render(s) {
  paintWarp(s)
  paintLattice(s)
  s.marks.set('dirty', true)
  s.canvas.requestRenderAll()
  if (import.meta.env.DEV) s.stat.n++
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

function stopRaf(s) {
  if (!s.raf) return
  cancelAnimationFrame(s.raf)
  s.raf = null
}

// --- taking hold ---------------------------------------------------------

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

// The cell under the pointer. Cells are curved quads in destination space, so
// there is no closed-form inverse; a coarse scan for the nearest sampled
// (u,v) is more than exact enough to name a cell and costs nothing at these
// sizes. A press out in the skirt simply takes the nearest edge cell.
function cellAt(s, p) {
  const N = s.lattice.cells
  const surface = makeSurface(s.lattice)
  const steps = N * FIND_SUB
  const q = { x: 0, y: 0 }
  let bu = 0
  let bv = 0
  let bd = Infinity
  for (let j = 0; j <= steps; j++) {
    for (let i = 0; i <= steps; i++) {
      surface(i / steps, j / steps, q)
      const dx = q.x * s.w - p.x
      const dy = q.y * s.h - p.y
      const d = dx * dx + dy * dy
      if (d < bd) {
        bd = d
        bu = i / steps
        bv = j / steps
      }
    }
  }
  const i = Math.min(N - 1, Math.floor(bu * N))
  const j = Math.min(N - 1, Math.floor(bv * N))
  return { i, j }
}

function heldNodes(s) {
  const N = s.lattice.cells
  if (s.held.kind === 'node') return [s.held.j * (N + 1) + s.held.i]
  const { i, j } = s.held
  return [
    j * (N + 1) + i,
    j * (N + 1) + i + 1,
    (j + 1) * (N + 1) + i,
    (j + 1) * (N + 1) + i + 1
  ]
}

function cancelDrag(s) {
  if (!s.held) return false
  stopRaf(s)
  s.lattice = s.held.before
  s.held = null
  render(s)
  return true
}

// DEV only, and deliberately just the frame rate. Two earlier versions of this
// reported per-stage millisecond timings and both were fiction: canvas2d
// returns as soon as a call is QUEUED, not when it is drawn, so a 71ms frame
// honestly reported "6ms of work" and sent me tuning the wrong thing twice.
// Anything finer than fps here needs a forced flush (read one pixel back) to
// mean anything — worth remembering before adding a timer to this file.
const resetStat = (s) => {
  s.stat = { n: 0, t0: performance.now() }
}

function logDrag(s) {
  const secs = (performance.now() - s.stat.t0) / 1000
  if (!s.stat.n || secs <= 0) return
  console.log(
    `[gwarp] drag ${s.lattice.cells}× @ ${s.fast.width}px: ` +
      `${s.stat.n} frames / ${secs.toFixed(2)}s = ${Math.round(s.stat.n / secs)}fps`
  )
}

function attach(s) {
  const canvas = s.canvas
  const point = (opt) => opt.scenePoint ?? canvas.getScenePoint(opt.e)

  s.onDown = (opt) => {
    if (canvas.__navPanArmed) return // Space held: a pan is in progress
    const p = point(opt)
    const node = nodeAt(s, p)
    const held = node ? { kind: 'node', ...node } : { kind: 'cell', ...cellAt(s, p) }
    s.held = { ...held, before: snapshot(s.lattice), moved: false }
    if (import.meta.env.DEV) resetStat(s)
    // Every held node keeps its own offset from the press, so taking hold near
    // the edge of the grab radius doesn't snap anything under the cursor.
    s.held.origin = heldNodes(s).map((k) => ({
      k,
      dx: s.lattice.nodes[k].x - p.x / s.w,
      dy: s.lattice.nodes[k].y - p.y / s.h
    }))
    paintLattice(s)
    s.marks.set('dirty', true)
    canvas.requestRenderAll()
  }

  s.onMove = (opt) => {
    if (!s.held) return
    const p = point(opt)
    for (const o of s.held.origin) {
      s.lattice.nodes[o.k].x = p.x / s.w + o.dx
      s.lattice.nodes[o.k].y = p.y / s.h + o.dy
    }
    s.held.moved = true
    schedule(s)
  }

  s.onUp = () => {
    if (!s.held) return
    stopRaf(s)
    const { before, moved } = s.held
    if (import.meta.env.DEV && moved) logDrag(s)
    s.held = null
    // A press that never moved is not a gesture — no history, no step to undo.
    if (moved) commitGesture(s, before)
    // Once more with the hand off the sheet: drops the held node's highlight
    // and re-renders at the idle tier, which is the only moment the preview
    // changes resolution.
    render(s)
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
  stopRaf(s)
  s.canvas.defaultCursor = s.savedCursor
}

// --- accents -------------------------------------------------------------

// G hides the lattice so the piece can be read clean, mid-card, without
// committing to it — Photoshop's Cmd+H. The handles stay live while hidden
// (also Photoshop's behaviour): it is a look, not a mode.
// Esc backs out the drag in progress; with nothing in hand it returns false so
// the key passes along to the global back-out (Lift's precedent).
export const gwarpHotkeys = [
  {
    key: 'g',
    run: ({ session, canvas }) => {
      if (!session?.marks) return false
      session.marks.visible = !session.marks.visible
      canvas?.requestRenderAll()
    }
  },
  {
    key: 'Escape',
    run: ({ session }) => (session && cancelDrag(session) ? undefined : false)
  }
]

// --- hooks ---------------------------------------------------------------

const surfaceFor = (w, h, scale) => {
  const el = document.createElement('canvas')
  el.width = Math.round(w * scale)
  el.height = Math.round(h * scale)
  return el
}

export function beginGwarp(ctx) {
  const W = ctx.canvasWidth
  const H = ctx.canvasHeight
  const fine = surfaceFor(W, H, VIEW_IDLE)
  const fast = surfaceFor(W, H, VIEW_DRAG)
  const lat = surfaceFor(W, H, VIEW_MARKS)

  // Every overlay fills the artboard, whatever its own resolution is.
  const seat = (el) => ({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: W / el.width,
    scaleY: H / el.height,
    selectable: false,
    evented: false,
    // Both elements are repainted in place, so Fabric must not hold a cached
    // bitmap of either (Ghost and Rails redraw the same way).
    objectCaching: false
  })

  const s = {
    fine,
    fast,
    view: fine,
    lat,
    canvas: ctx.canvas,
    w: W,
    h: H,
    img: new fabric.FabricImage(fine, seat(fine)),
    marks: new fabric.FabricImage(lat, seat(lat)),
    textures: new Map(), // output width → padded texture built to match it
    master: ctx.master,
    lattice: createLattice(ctx.controls.grid),
    grid: ctx.controls.grid,
    report: ctx.report,
    setControl: ctx.setControl,
    past: [],
    future: [],
    held: null,
    raf: null,
    stat: { n: 0, t0: 0 }
  }

  // Warp first, lattice over it.
  ctx.canvas.add(s.img)
  ctx.canvas.add(s.marks)
  render(s)

  s.undo = () => step(s, s.past, s.future)
  s.redo = () => step(s, s.future, s.past)
  s.reset = () => {
    if (s.held || isFlatLattice(s.lattice)) return
    commitGesture(s, snapshot(s.lattice))
    s.lattice = createLattice(s.lattice.cells)
    render(s)
  }
  ctx.report({ undo: s.undo, redo: s.redo, reset: s.reset, canUndo: false, canRedo: false })

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
  const before = snapshot(s.lattice)
  s.lattice = resampleLattice(s.lattice, grid)
  s.grid = grid
  s.held = null
  // A density change on an already-flat sheet changes nothing anyone could
  // want back, so it stays off the undo stack.
  if (!isFlatLattice(s.lattice)) commitGesture(s, before)
  render(s)
}

export function commitGwarp(ctx) {
  const s = ctx.session
  if (!s) return
  detach(s)
  // THE render. Everything on screen until now was a proxy at artboard scale;
  // this is the one that meets the universal bake, so it is drawn at the
  // master's own resolution and swapped in before Editor flattens. Same
  // lattice, so the same picture — only resolved. Building the canvas here
  // rather than holding it all session keeps 7.2 megapixels out of memory
  // alongside the padded texture.
  const full = document.createElement('canvas')
  full.width = s.master.width
  full.height = s.master.height
  renderWarp(full, textureFor(s, full), s.lattice)
  mount(s, full)
  // The lattice is scaffolding, not the piece: it comes off before the bake.
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

export function GwarpTools({ controls, info, ready, onControlChange }) {
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
      <div className="undo-row">
        <button type="button" className="secondary" title="Cmd/Ctrl+Z" disabled={!info.canUndo} onClick={() => info.undo?.()}>
          Undo
        </button>
        <button type="button" className="secondary" title="Cmd/Ctrl+Shift+Z" disabled={!info.canRedo} onClick={() => info.redo?.()}>
          Redo
        </button>
        <button type="button" className="secondary" title="Flatten the lattice back out" onClick={() => info.reset?.()}>
          Reset
        </button>
      </div>
    </div>
  )
}
