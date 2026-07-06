// Rails — a shattered stamp. One random image is dealt, and the card
// reads it for its MOST SHATTERED form (decided with Stew, Phase 10):
// the winning mask (see shatter.js — the machinery is shared with
// Shattered Transfer) becomes a solid-color cutout you arrange, tint,
// fade and work with the mask brush. End bakes it on. No sidecar — pure
// canvas2d.

import * as fabric from 'fabric'
import { createMaskSession } from '../brushCore.js'
import { sampleImages } from '../sampling.js'
import { READING_LABEL, computeLum, maskFor, maskToCanvas, pickMostShattered } from '../shatter.js'
import { ArrangeMaskControls } from './maskControls.jsx'

function tint(tinted, maskCanvas, color) {
  const g = tinted.getContext('2d')
  g.save()
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, tinted.width, tinted.height)
  g.fillStyle = color
  g.fillRect(0, 0, tinted.width, tinted.height)
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(maskCanvas, 0, 0)
  g.restore()
}

export async function beginRails(ctx) {
  const [file] = await sampleImages(1, ctx.imageList)
  ctx.report({ stage: 'shattering' })
  const img = await fabric.FabricImage.fromURL(`/api/images/${encodeURIComponent(file)}`)
  if (ctx.isCancelled?.()) return null
  const el = img.getElement()

  const winner = pickMostShattered(el)
  const lum = computeLum(el, img.width, img.height)
  const mask = maskFor(lum, img.width, img.height, winner)
  const maskCanvas = maskToCanvas(mask, img.width, img.height)

  const tinted = document.createElement('canvas')
  tinted.width = img.width
  tinted.height = img.height
  tint(tinted, maskCanvas, ctx.controls.color)
  img.setElement(tinted)

  const scale = Math.min((ctx.canvasWidth * 0.65) / img.width, (ctx.canvasHeight * 0.65) / img.height)
  img.set({
    originX: 'center',
    originY: 'center',
    left: ctx.canvasWidth / 2,
    top: ctx.canvasHeight / 2,
    scaleX: scale,
    scaleY: scale,
    opacity: ctx.controls.opacity
  })
  ctx.canvas.add(img)
  ctx.canvas.setActiveObject(img)
  ctx.canvas.requestRenderAll()

  const controlsRef = { current: ctx.controls }
  const session = createMaskSession(ctx.canvas, [img], {
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo }),
    onSizeChange: (size) => ctx.setControl('size', size)
  })
  ctx.report({
    stage: 'work',
    reading: READING_LABEL[winner.kind],
    undo: session.undo,
    redo: session.redo,
    canUndo: false,
    canRedo: false
  })
  return { img, maskCanvas, tinted, session, controlsRef, lastColor: ctx.controls.color }
}

export function updateRails(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.img.set({ opacity: ctx.controls.opacity })
  if (ctx.controls.color !== s.lastColor) {
    tint(s.tinted, s.maskCanvas, ctx.controls.color)
    s.lastColor = ctx.controls.color
    s.session.refresh()
  }
  s.session.setActive(ctx.controls.mode !== 'arrange')
  ctx.canvas.requestRenderAll()
}

export function commitRails(ctx) {
  // Drop the brush; the shattered stamp stays for the universal bake.
  ctx.session?.session.dispose()
}

export function cleanupRails(ctx) {
  const s = ctx.session
  if (!s) return
  s.session.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

export function RailsTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'shattering' || !ready) {
    return <span className="hint">Reading the image for its most shattered form…</span>
  }
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        This image {info.reading ?? 'shattered'}. Arrange the fragments, tint them,
        fade them, work into them with the brush.
      </p>
      <ArrangeMaskControls controls={controls} info={info} onControlChange={onControlChange} />
      <label className="ctrl" title="N — new hue">
        <span className="ctrl-label">Color</span>
        <input
          type="color"
          value={controls.color}
          onChange={(e) => onControlChange('color', e.target.value)}
        />
        <span className="ctrl-value mono">{controls.color}</span>
      </label>
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
    </div>
  )
}
