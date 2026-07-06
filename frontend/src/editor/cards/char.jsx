// Char — Rails' shadow sibling (Stencil × Sink). One random image is read
// for its most shattered form (shatter.js, same reading as Rails), but the
// fragments don't paint a color — they scorch: the cutout sits in
// `multiply` blend as a grey burn, darkening whatever is beneath. Depth
// sets how deep the char goes (white = untouched, black = burned through);
// opacity fades the whole mark. Arrange + the standing mask brush, as ever.
// No sidecar — pure canvas2d.

import * as fabric from 'fabric'
import { createMaskSession } from '../brushCore.js'
import { sampleImages } from '../sampling.js'
import { READING_LABEL, computeLum, maskFor, maskToCanvas, pickMostShattered } from '../shatter.js'
import { ArrangeMaskControls, maskHint } from './maskControls.jsx'

// Fill the fragments with the char grey: depth 0 → white (multiply no-op),
// depth 1 → black (burned through).
function scorch(scorched, maskCanvas, depth) {
  const v = Math.round(255 * (1 - depth))
  const g = scorched.getContext('2d')
  g.save()
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, scorched.width, scorched.height)
  g.fillStyle = `rgb(${v}, ${v}, ${v})`
  g.fillRect(0, 0, scorched.width, scorched.height)
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(maskCanvas, 0, 0)
  g.restore()
}

export async function beginChar(ctx) {
  const [file] = await sampleImages(1, ctx.imageList)
  ctx.report({ stage: 'shattering' })
  const img = await fabric.FabricImage.fromURL(`/api/images/${encodeURIComponent(file)}`)
  if (ctx.isCancelled?.()) return null
  const el = img.getElement()

  const winner = pickMostShattered(el)
  const lum = computeLum(el, img.width, img.height)
  const mask = maskFor(lum, img.width, img.height, winner)
  const maskCanvas = maskToCanvas(mask, img.width, img.height)

  const scorched = document.createElement('canvas')
  scorched.width = img.width
  scorched.height = img.height
  scorch(scorched, maskCanvas, ctx.controls.depth)
  img.setElement(scorched)

  const scale = Math.min((ctx.canvasWidth * 0.65) / img.width, (ctx.canvasHeight * 0.65) / img.height)
  img.set({
    originX: 'center',
    originY: 'center',
    left: ctx.canvasWidth / 2,
    top: ctx.canvasHeight / 2,
    scaleX: scale,
    scaleY: scale,
    globalCompositeOperation: 'multiply',
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
  return { img, maskCanvas, scorched, session, controlsRef, lastDepth: ctx.controls.depth }
}

export function updateChar(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.img.set({ opacity: ctx.controls.opacity })
  if (ctx.controls.depth !== s.lastDepth) {
    scorch(s.scorched, s.maskCanvas, ctx.controls.depth)
    s.lastDepth = ctx.controls.depth
    s.session.refresh()
  }
  s.session.setActive(ctx.controls.mode !== 'arrange')
  ctx.canvas.requestRenderAll()
}

export function commitChar(ctx) {
  // Drop the brush; the char stays for the universal bake.
  ctx.session?.session.dispose()
}

export function cleanupChar(ctx) {
  const s = ctx.session
  if (!s) return
  s.session.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

export function CharTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'shattering' || !ready) {
    return <span className="hint">Reading the image for its most shattered form…</span>
  }
  const brushing = controls.mode !== 'arrange'
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        {brushing
          ? maskHint(controls.mode, 'the char')
          : `This image ${info.reading ?? 'shattered'}. The fragments scorch what is beneath — arrange them, set the depth of the burn.`}
      </p>
      <ArrangeMaskControls controls={controls} info={info} onControlChange={onControlChange} />
      <label className="ctrl">
        <span className="ctrl-label">Depth</span>
        <input
          type="range"
          min="10"
          max="100"
          value={Math.round(controls.depth * 100)}
          onChange={(e) => onControlChange('depth', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.depth * 100)}%</span>
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
