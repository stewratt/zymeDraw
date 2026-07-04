// Ghost — a second exposure. A fresh grid of 8 is dealt; take one and it
// joins the piece in `screen` blend, so only its light survives — dark
// areas vanish, bright areas glow through. Freedom inside the constraint:
// free transform, opacity, brightness/contrast, and the standing mask
// brush. End bakes it in.
//
// The chain: begin() deals the grid, then *waits* on the user's pick — the
// promise resolves through a callback reported to the Overlay. Until it
// resolves the card isn't ready, so End stays disabled while you choose.
//
// Brightness/contrast never touch the original pixels: the image's element
// is a `filtered` canvas redrawn from the original through ctx.filter, and
// the mask session composites from that same canvas — so brush strokes,
// BC changes and the 3× bake all read full-resolution truth. Using 2d
// ctx.filter (not Fabric's WebGL filters) also sidesteps the §9 concern
// about WebGL filters + globalCompositeOperation at bake time.

import * as fabric from 'fabric'
import { createMaskSession } from '../brushCore.js'
import { CardGridPicker } from '../GridPicker.jsx'
import { sampleImages } from '../sampling.js'
import { ArrangeMaskControls, maskHint } from './maskControls.jsx'

const GRID_SIZE = 8

function drawFiltered(filtered, original, controls) {
  const ctx = filtered.getContext('2d')
  ctx.save()
  ctx.clearRect(0, 0, filtered.width, filtered.height)
  ctx.filter = `brightness(${controls.brightness}%) contrast(${controls.contrast}%)`
  ctx.drawImage(original, 0, 0)
  ctx.restore()
}

export async function beginGhost(ctx) {
  const files = await sampleImages(GRID_SIZE, ctx.imageList)
  const chosen = await new Promise((resolve) => {
    ctx.report({ stage: 'pick', gridFiles: files, pick: resolve })
  })

  const img = await fabric.FabricImage.fromURL(`/api/images/${encodeURIComponent(chosen)}`)
  if (ctx.isCancelled?.()) return null
  const original = img.getElement()
  const filtered = document.createElement('canvas')
  filtered.width = img.width
  filtered.height = img.height
  drawFiltered(filtered, original, ctx.controls)
  img.setElement(filtered)

  const scale = Math.min(
    (ctx.canvasWidth * 0.65) / img.width,
    (ctx.canvasHeight * 0.65) / img.height
  )
  img.set({
    originX: 'center',
    originY: 'center',
    left: ctx.canvasWidth / 2,
    top: ctx.canvasHeight / 2,
    scaleX: scale,
    scaleY: scale,
    globalCompositeOperation: 'screen',
    opacity: ctx.controls.opacity
  })
  ctx.canvas.add(img)
  ctx.canvas.setActiveObject(img)
  ctx.canvas.requestRenderAll()

  const controlsRef = { current: ctx.controls }
  const session = createMaskSession(ctx.canvas, [img], {
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo })
  })
  ctx.report({
    stage: 'work',
    gridFiles: null,
    pick: null,
    undo: session.undo,
    redo: session.redo,
    canUndo: false,
    canRedo: false
  })
  return { img, original, filtered, session, controlsRef, lastControls: ctx.controls }
}

export function updateGhost(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.img.set({ opacity: ctx.controls.opacity })
  if (
    ctx.controls.brightness !== s.lastControls.brightness ||
    ctx.controls.contrast !== s.lastControls.contrast
  ) {
    drawFiltered(s.filtered, s.original, ctx.controls)
    s.session.refresh()
  }
  s.session.setActive(ctx.controls.mode !== 'arrange')
  s.lastControls = ctx.controls
  ctx.canvas.requestRenderAll()
}

export function commitGhost(ctx) {
  // Drop the brush; the screen-blended image stays for the universal bake.
  ctx.session?.session.dispose()
}

export function cleanupGhost(ctx) {
  const s = ctx.session
  if (!s) return
  s.session.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

// Canvas-area overlay: the grid, only while the pick is open.
export function GhostOverlay({ info }) {
  if (info.stage !== 'pick' || !info.gridFiles) return null
  return (
    <CardGridPicker
      title="GHOST"
      hint="Eight images. Take one — it joins the piece as a second exposure: only its light survives."
      files={info.gridFiles}
      confirmLabel="Continue — place the ghost"
      onConfirm={(f) => info.pick?.(f)}
    />
  )
}

export function GhostTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'pick') return <span className="hint">Take one image from the grid.</span>
  if (!ready) return <span className="hint">Preparing…</span>
  const brushing = controls.mode !== 'arrange'
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        {brushing
          ? maskHint(controls.mode, 'the ghost')
          : 'Drag, scale, rotate the ghost into place. Only its light survives the blend.'}
      </p>
      <ArrangeMaskControls controls={controls} info={info} onControlChange={onControlChange} />
      <label className="ctrl">
        <span className="ctrl-label">Opacity</span>
        <input
          type="range"
          min="5"
          max="100"
          value={Math.round(controls.opacity * 100)}
          onChange={(e) => onControlChange('opacity', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.opacity * 100)}%</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Brightness</span>
        <input
          type="range"
          min="25"
          max="200"
          value={controls.brightness}
          onChange={(e) => onControlChange('brightness', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.brightness}%</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Contrast</span>
        <input
          type="range"
          min="25"
          max="200"
          value={controls.contrast}
          onChange={(e) => onControlChange('contrast', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.contrast}%</span>
      </label>
    </div>
  )
}
