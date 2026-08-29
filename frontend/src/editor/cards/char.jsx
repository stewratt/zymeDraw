// Char — Rails' shadow sibling (Stencil × Sink). One random image is read
// for its most shattered form (shatter.js, same reading as Rails), but the
// fragments don't paint a solid color like Rails — they keep the source
// photo's own tones, composited normally (source-over) so the photograph's
// natural variance reads instead of a flat wash. Two knobs shape the burn:
// `Darken` crushes every tone toward black (0 = the photo's real brightness,
// 1 = pure black — it only ever darkens, never lightens: the char flavour);
// `Saturation` decides how much of the original hue survives (0 = pure B&W).
// Transparency is left to opacity + the standing mask brush. No sidecar.

import * as fabric from 'fabric'
import { createMaskSession } from '../brushCore.js'
import { CARD_TEXT } from '../cardText.js'
import { imageUrl, sampleImages } from '../imageStore.js'
import { READING_LABEL, computeLum, maskFor, maskToCanvas, pickMostShattered } from '../shatter.js'
import { ArrangeMaskControls, maskHint } from './maskControls.jsx'
import { UI, fmt } from '../../copy/uiText.js'

// The source photo's raw pixels, grabbed once per deal (getImageData is
// same-origin here, so no CORS taint — shatter.js reads the same element).
// Depth and Saturation both re-process these, so we keep the colour data.
function readSource(el, w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.drawImage(el, 0, 0, w, h)
  return g.getImageData(0, 0, w, h)
}

// Turn the source pixels into char: each pixel's colour is pulled toward its
// own grey (keeping `saturation` of the original hue) and then crushed toward
// black by `darken`. Alpha is left untouched — transparency isn't this
// slider's job — so the mask alone decides the fragment shape.
function scorch(scorched, srcData, maskCanvas, darken, saturation) {
  const w = scorched.width
  const h = scorched.height
  const g = scorched.getContext('2d')
  const src = srcData.data
  const out = g.createImageData(w, h)
  const dst = out.data
  const keep = 1 - darken // brightness that survives: darken 1 → pure black
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]
    const gr = src[i + 1]
    const b = src[i + 2]
    const lum = 0.299 * r + 0.587 * gr + 0.114 * b
    // Residual colour (sat 0 → grey, sat 1 → the untouched hue), then darken.
    dst[i] = (lum + (r - lum) * saturation) * keep
    dst[i + 1] = (lum + (gr - lum) * saturation) * keep
    dst[i + 2] = (lum + (b - lum) * saturation) * keep
    dst[i + 3] = src[i + 3]
  }
  // putImageData overwrites the whole canvas, so no clear needed; then the
  // shattered mask trims it to the fragments.
  g.putImageData(out, 0, 0)
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(maskCanvas, 0, 0)
  g.globalCompositeOperation = 'source-over'
}

export async function beginChar(ctx) {
  const [file] = await sampleImages(1, ctx.imageList)
  ctx.report({ stage: 'shattering' })
  const img = await fabric.FabricImage.fromURL(imageUrl(file))
  if (ctx.isCancelled?.()) return null
  const el = img.getElement()

  const winner = pickMostShattered(el)
  const lum = computeLum(el, img.width, img.height)
  const mask = maskFor(lum, img.width, img.height, winner)
  const maskCanvas = maskToCanvas(mask, img.width, img.height)

  const srcData = readSource(el, img.width, img.height)
  const scorched = document.createElement('canvas')
  scorched.width = img.width
  scorched.height = img.height
  scorch(scorched, srcData, maskCanvas, ctx.controls.darken, ctx.controls.saturation)
  img.setElement(scorched)

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
  return {
    img,
    maskCanvas,
    srcData,
    scorched,
    session,
    controlsRef,
    lastDarken: ctx.controls.darken,
    lastSaturation: ctx.controls.saturation
  }
}

export function updateChar(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.img.set({ opacity: ctx.controls.opacity })
  if (ctx.controls.darken !== s.lastDarken || ctx.controls.saturation !== s.lastSaturation) {
    scorch(s.scorched, s.srcData, s.maskCanvas, ctx.controls.darken, ctx.controls.saturation)
    s.lastDarken = ctx.controls.darken
    s.lastSaturation = ctx.controls.saturation
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
    return <span className="hint">{UI.shared.shattering}</span>
  }
  const brushing = controls.mode !== 'arrange'
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        {brushing
          ? maskHint(controls.mode, UI.cardHints.char.subject)
          : `${fmt(UI.shared.shatteredIntro, { reading: info.reading ?? 'shattered' })} ${CARD_TEXT.char.description}`}
      </p>
      <ArrangeMaskControls controls={controls} info={info} onControlChange={onControlChange} />
      <label className="ctrl">
        <span className="ctrl-label">Darken</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(controls.darken * 100)}
          onChange={(e) => onControlChange('darken', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.darken * 100)}%</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Saturation</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(controls.saturation * 100)}
          onChange={(e) => onControlChange('saturation', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.saturation * 100)}%</span>
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
