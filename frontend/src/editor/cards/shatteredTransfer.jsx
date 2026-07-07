// Shattered Transfer — an image becomes a stencil, and the style transfer
// shows through only where its shattered form sits. A grid of 6 is dealt;
// the chosen image is never placed as pixels — it's READ (shatter.js, the
// same eye as Rails) and its mask becomes a free-transform window. From
// the moment the card begins, the sidecar redraws the whole piece in the
// transfer style in the background; when it lands, the window goes live:
// wherever the fragments sit, the redraw shows through, and dragging the
// stencil sweeps the style across the piece.
//
// Brush marks live on the PIECE, not the stencil — they're strokes in
// overlay space, so trimmed fragments stay trimmed if the stencil is
// re-arranged afterwards. Influence sets how strongly the styled layer
// sits. End bakes what remains.
//
// The overlay composite (the card's own stroke-engine consumer — the
// built-in mask/reveal sessions can't express the moving window):
//
//   composite = styled pixels
//             ∩ windowMask     (stencil mask at its current transform)
//             − mask strokes   (committed mask + live stroke)
//
// Graceful degradation (mandatory, CLAUDE.md §3): sidecar down or transfer
// failed → the stencil is withdrawn, the panel says so, End moves on.

import * as fabric from 'fabric'
import { applyMaskOp, clearLayer, createStrokeEngine, makeLayer, snapshotMaskSettings } from '../brushCore.js'
import { CardGridPicker } from '../GridPicker.jsx'
import { sampleImages } from '../sampling.js'
import { READING_LABEL, computeLum, maskFor, maskToCanvas, pickMostShattered } from '../shatter.js'
import { fetchStyledCanvas } from '../styleTransfer.js'
import { ArrangeMaskControls, maskHint } from './maskControls.jsx'
import { UI, fmt } from '../../copy/uiText.js'

const H = UI.cardHints.shatteredTransfer

const GRID_SIZE = 6

// The stencil object's own pixels: the fragments in flat white, faint
// enough to sit over the styled content as a grab-handle. Before the
// transfer lands this doubles as the placement preview.
function drawHandle(handle, maskCanvas, alpha) {
  const g = handle.getContext('2d')
  g.save()
  g.clearRect(0, 0, handle.width, handle.height)
  g.globalAlpha = alpha
  g.drawImage(maskCanvas, 0, 0)
  g.restore()
}

export async function beginShatteredTransfer(ctx) {
  // Fire the redraw first — it computes while the user picks and arranges.
  const styledPromise = fetchStyledCanvas(ctx.master).catch(() => null)

  const files = await sampleImages(GRID_SIZE, ctx.imageList)
  const chosen = await new Promise((resolve) => {
    ctx.report({ stage: 'pick', gridFiles: files, pick: resolve })
  })
  ctx.report({ stage: 'shattering', gridFiles: null, pick: null })

  const img = await fabric.FabricImage.fromURL(`/api/images/${encodeURIComponent(chosen)}`)
  if (ctx.isCancelled?.()) return null
  const el = img.getElement()

  const winner = pickMostShattered(el)
  const lum = computeLum(el, img.width, img.height)
  const maskCanvas = maskToCanvas(maskFor(lum, img.width, img.height, winner), img.width, img.height)

  const handle = makeLayer(img.width, img.height)
  drawHandle(handle, maskCanvas, 0.35)
  img.setElement(handle)

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
    scaleY: scale
  })
  ctx.canvas.add(img)
  ctx.canvas.setActiveObject(img)
  ctx.canvas.requestRenderAll()
  ctx.report({ stage: 'arrange', reading: READING_LABEL[winner.kind] })

  const styled = await styledPromise
  if (ctx.isCancelled?.()) {
    ctx.canvas.remove(img)
    return null
  }
  if (!styled) {
    // degrade: no styled pixels exist, so the stencil has nothing to show
    ctx.canvas.remove(img)
    ctx.canvas.requestRenderAll()
    ctx.report({ stage: 'work', degraded: true })
    return null
  }

  // ---- the window overlay: styled ∩ window − strokes ----
  const windowMask = makeLayer(styled.width, styled.height)
  const committedMask = makeLayer(styled.width, styled.height)
  const strokeMask = makeLayer(styled.width, styled.height)
  const effMask = makeLayer(styled.width, styled.height) // live-stroke preview
  const blurScratch = makeLayer(styled.width, styled.height) // soften staging
  const composite = makeLayer(styled.width, styled.height)

  const overlay = new fabric.FabricImage(composite, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: ctx.canvasWidth / composite.width,
    scaleY: ctx.canvasHeight / composite.height,
    selectable: false,
    evented: false,
    opacity: ctx.controls.opacity
  })
  ctx.canvas.add(overlay)
  ctx.canvas.bringObjectToFront(img) // the handle rides above its content

  // Stamp the stencil mask into overlay space at the object's current
  // canvas transform (object-local, centered origin → display → styled px).
  function stampWindow() {
    const g = windowMask.getContext('2d')
    g.save()
    g.clearRect(0, 0, windowMask.width, windowMask.height)
    g.scale(windowMask.width / ctx.canvasWidth, windowMask.width / ctx.canvasWidth)
    const m = img.calcTransformMatrix()
    g.transform(m[0], m[1], m[2], m[3], m[4], m[5])
    g.drawImage(maskCanvas, -img.width / 2, -img.height / 2)
    g.restore()
  }

  const state = {
    strokeMask,
    strokes: [],
    bakeStroke(stroke) {
      applyMaskOp(committedMask, strokeMask, blurScratch, stroke)
    },
    clearCommitted() {
      clearLayer(committedMask)
    },
    recomposite(liveStroke) {
      let mask = committedMask
      if (liveStroke) {
        const e = effMask.getContext('2d')
        e.clearRect(0, 0, effMask.width, effMask.height)
        e.drawImage(committedMask, 0, 0)
        applyMaskOp(effMask, strokeMask, blurScratch, liveStroke)
        mask = effMask
      }
      const g = composite.getContext('2d')
      g.save()
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, composite.width, composite.height)
      g.drawImage(styled, 0, 0)
      g.globalCompositeOperation = 'destination-in'
      g.drawImage(windowMask, 0, 0)
      g.globalCompositeOperation = 'destination-out'
      g.drawImage(mask, 0, 0)
      g.restore()
      overlay.dirty = true
      ctx.canvas.requestRenderAll()
    }
  }

  const controlsRef = { current: ctx.controls }
  const engine = createStrokeEngine(ctx.canvas, {
    states: new Map([[overlay, state]]),
    // The overlay covers the whole canvas; every stroke belongs to it.
    resolveTarget: () => overlay,
    getControls: () => controlsRef.current,
    snapshotSettings: snapshotMaskSettings,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo }),
    onSizeChange: (size) => ctx.setControl('size', size)
  })

  const onTransform = (opt) => {
    if (opt.target !== img) return
    stampWindow()
    state.recomposite(null)
  }
  ctx.canvas.on('object:moving', onTransform)
  ctx.canvas.on('object:scaling', onTransform)
  ctx.canvas.on('object:rotating', onTransform)
  ctx.canvas.on('object:modified', onTransform)

  // The window goes live: content comes from the overlay now, so the
  // handle fades to a grab-hint.
  drawHandle(handle, maskCanvas, 0.12)
  img.dirty = true
  stampWindow()
  state.recomposite(null)

  const dispose = () => {
    engine.dispose()
    ctx.canvas.off('object:moving', onTransform)
    ctx.canvas.off('object:scaling', onTransform)
    ctx.canvas.off('object:rotating', onTransform)
    ctx.canvas.off('object:modified', onTransform)
  }

  ctx.report({
    stage: 'work',
    degraded: false,
    undo: engine.undo,
    redo: engine.redo,
    canUndo: false,
    canRedo: false
  })
  return { img, overlay, engine, controlsRef, dispose }
}

export function updateShatteredTransfer(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.overlay.set({ opacity: ctx.controls.opacity })
  s.engine.setActive(ctx.controls.mode !== 'arrange')
  // While brushing, the handle would read as untouched residue — hide it.
  s.img.visible = ctx.controls.mode === 'arrange'
  ctx.canvas.requestRenderAll()
}

export function commitShatteredTransfer(ctx) {
  const s = ctx.session
  if (!s) return
  // Drop the brush and the stencil handle; the overlay stays for the bake.
  s.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

export function cleanupShatteredTransfer(ctx) {
  const s = ctx.session
  if (!s) return
  s.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.remove(s.overlay)
  ctx.canvas.requestRenderAll()
}

export function ShatteredTransferOverlay({ info }) {
  if (info.stage !== 'pick' || !info.gridFiles) return null
  return (
    <CardGridPicker
      title={H.pickTitle}
      hint={H.pickHint}
      files={info.gridFiles}
      confirmLabel={H.confirm}
      onConfirm={(f) => info.pick?.(f)}
    />
  )
}

export function ShatteredTransferTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'pick') return <span className="hint">{UI.shared.takeOne}</span>
  if (info.stage === 'shattering') {
    return <span className="hint">{UI.shared.shattering}</span>
  }
  if (info.stage === 'arrange' && !ready) {
    return (
      <span className="hint">{fmt(H.arrangeWaiting, { reading: info.reading ?? 'shattered' })}</span>
    )
  }
  if (info.degraded) {
    return <span className="hint">{H.degraded}</span>
  }
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  const brushing = controls.mode !== 'arrange'
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        {brushing
          ? maskHint(controls.mode, H.subject)
          : fmt(H.windowOpen, {
              readingClause: info.reading ? fmt(H.readingClause, { reading: info.reading }) : ''
            })}
      </p>
      <label className="ctrl">
        <span className="ctrl-label">Influence</span>
        <input
          type="range"
          min="5"
          max="100"
          value={Math.round(controls.opacity * 100)}
          onChange={(e) => onControlChange('opacity', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round(controls.opacity * 100)}%</span>
      </label>
      <ArrangeMaskControls controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
