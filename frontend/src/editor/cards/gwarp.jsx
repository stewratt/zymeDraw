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
// PHASE 1 (this commit) renders the lattice at rest only: no handles, no
// dragging. The checkpoint it exists for is that an unbent lattice must give
// the piece back pixel-identical — if the mesh softens or shifts the image at
// identity, the subdivision or the affine solve is wrong and every later phase
// would inherit the drift.

import * as fabric from 'fabric'
import { createLattice, makePaddedTexture, renderWarp } from '../warpMesh.js'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'

export const GRID_MIN = 2
export const GRID_MAX = 5

function paint(session) {
  const t = performance.now()
  renderWarp(session.el, session.texture, session.lattice)
  if (import.meta.env.DEV) {
    console.log(`[gwarp] ${session.lattice.cells}× lattice rendered in ${Math.round(performance.now() - t)}ms`)
  }
  session.img.set('dirty', true)
}

export function beginGwarp(ctx) {
  const el = document.createElement('canvas')
  el.width = ctx.master.width
  el.height = ctx.master.height

  const img = new fabric.FabricImage(el, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: ctx.canvasWidth / el.width,
    scaleY: ctx.canvasHeight / el.height,
    selectable: false,
    evented: false,
    // The element is repainted in place on every change, so Fabric must not
    // hold a cached bitmap of it (Ghost and Rails redraw the same way).
    objectCaching: false
  })

  const session = {
    el,
    img,
    texture: makePaddedTexture(ctx.master),
    lattice: createLattice(ctx.controls.grid)
  }
  paint(session)
  ctx.canvas.add(img)
  ctx.canvas.requestRenderAll()
  return session
}

export function updateGwarp(ctx) {
  const s = ctx.session
  if (!s || ctx.controls.grid === s.lattice.cells) return
  // Phase 1: a denser lattice at rest is still at rest, so a plain rebuild is
  // honest here. Once nodes can move this becomes a RESAMPLE — the current
  // surface evaluated at the new node positions — so adding divisions refines
  // a bend instead of throwing it away (Affinity's behaviour).
  s.lattice = createLattice(ctx.controls.grid)
  paint(s)
  ctx.canvas.requestRenderAll()
}

export function cleanupGwarp(ctx) {
  const s = ctx.session
  if (!s) return
  ctx.canvas.remove(s.img)
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
