// Rails — a shattered stamp. One random image is dealt, and the card
// reads it for its MOST SHATTERED form (decided with Stew, Phase 10):
// ten candidate alpha masks are computed — luminance thresholds,
// posterize bands, edge maps — each scored by how many separate fragments
// it breaks into, and the winner becomes a solid-color cutout you
// arrange, tint, fade and erase. End bakes it on.
//
// Everything is plain canvas2d pixel work — no sidecar. Scoring runs on a
// 256-wide proxy (flood-fill component count is cheap there); the winning
// recipe is then applied at the image's native resolution.

import * as fabric from 'fabric'
import { createEraseSession } from '../brushCore.js'
import { sampleImages } from '../sampling.js'
import { ArrangeEraseControls } from './arrangeEraseControls.jsx'

const PROXY_W = 256
const CANDIDATES = [
  { kind: 'threshold', param: 70 },
  { kind: 'threshold', param: 110 },
  { kind: 'threshold', param: 150 },
  { kind: 'band', param: 0 },
  { kind: 'band', param: 1 },
  { kind: 'band', param: 2 },
  { kind: 'band', param: 3 },
  { kind: 'edges', param: 100 },
  { kind: 'edges', param: 140 },
  { kind: 'edges', param: 180 }
]
// masks covering almost nothing or almost everything aren't "shattered",
// they're empty or solid — excluded before scoring
const MIN_COVERAGE = 0.02
const MAX_COVERAGE = 0.65

function computeLum(el, w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(el, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  const lum = new Float32Array(w * h)
  for (let i = 0; i < lum.length; i++) {
    const j = i * 4
    lum[i] = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]
  }
  return lum
}

function maskFor(lum, w, h, cand) {
  const m = new Uint8Array(w * h)
  if (cand.kind === 'threshold') {
    for (let i = 0; i < m.length; i++) m[i] = lum[i] < cand.param ? 1 : 0
    return m
  }
  if (cand.kind === 'band') {
    for (let i = 0; i < m.length; i++) {
      m[i] = Math.min(3, Math.floor(lum[i] / 64)) === cand.param ? 1 : 0
    }
    return m
  }
  // edges: sobel magnitude, then one dilation pass for line weight
  const raw = new Uint8Array(w * h)
  const t2 = cand.param * cand.param
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] -
        lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1]
      const gy =
        lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] -
        lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1]
      if (gx * gx + gy * gy > t2) raw[i] = 1
    }
  }
  for (let i = 0; i < m.length; i++) {
    const x = i % w
    m[i] =
      raw[i] ||
      (x > 0 && raw[i - 1]) ||
      (x < w - 1 && raw[i + 1]) ||
      (i >= w && raw[i - w]) ||
      (i < m.length - w && raw[i + w])
        ? 1
        : 0
  }
  return m
}

// Shatteredness = how many separate fragments the mask breaks into
// (4-connected flood fill).
function countFragments(m, w) {
  const seen = new Uint8Array(m.length)
  const stack = []
  let count = 0
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || seen[i]) continue
    count++
    seen[i] = 1
    stack.push(i)
    while (stack.length) {
      const p = stack.pop()
      const x = p % w
      if (x > 0 && m[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1) }
      if (x < w - 1 && m[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1) }
      if (p >= w && m[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w) }
      if (p < m.length - w && m[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w) }
    }
  }
  return count
}

function pickMostShattered(el) {
  const pw = PROXY_W
  const ph = Math.max(1, Math.round((pw * el.height) / el.width))
  const lum = computeLum(el, pw, ph)
  let best = null
  for (const cand of CANDIDATES) {
    const m = maskFor(lum, pw, ph, cand)
    let area = 0
    for (let i = 0; i < m.length; i++) area += m[i]
    const cov = area / m.length
    if (cov < MIN_COVERAGE || cov > MAX_COVERAGE) continue
    const score = countFragments(m, pw)
    if (!best || score > best.score) best = { cand, score }
  }
  return best?.cand ?? { kind: 'threshold', param: 110 }
}

function maskToCanvas(m, w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const id = g.createImageData(w, h)
  for (let i = 0; i < m.length; i++) {
    if (m[i]) {
      const j = i * 4
      id.data[j] = 255
      id.data[j + 1] = 255
      id.data[j + 2] = 255
      id.data[j + 3] = 255
    }
  }
  g.putImageData(id, 0, 0)
  return c
}

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

const READING_LABEL = {
  threshold: 'shattered along its darks',
  band: 'shattered along its midtones',
  edges: 'shattered along its edges'
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
    opacity: ctx.controls.opacity
  })
  ctx.canvas.add(img)
  ctx.canvas.setActiveObject(img)
  ctx.canvas.requestRenderAll()

  const controlsRef = { current: ctx.controls }
  const session = createEraseSession(ctx.canvas, [img], {
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo })
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
  s.session.setActive(ctx.controls.mode === 'erase')
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
        fade them, erase into them.
      </p>
      <ArrangeEraseControls controls={controls} info={info} onControlChange={onControlChange} />
      <label className="ctrl">
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
