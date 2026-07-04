// The Graft chassis (v3 design §3.1): grid pick → one new image placed in a
// blend, with free transform, opacity, brightness/contrast, and the standing
// mask brush. A graft card = this factory + one config — the blend mode is
// the suit, the copy is the flavor (Ghost = Rise/screen, Stain =
// Sink/multiply).
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

function drawFiltered(filtered, original, controls) {
  const ctx = filtered.getContext('2d')
  ctx.save()
  ctx.clearRect(0, 0, filtered.width, filtered.height)
  ctx.filter = `brightness(${controls.brightness}%) contrast(${controls.contrast}%)`
  ctx.drawImage(original, 0, 0)
  ctx.restore()
}

// config: { title, subject, gridSize, blend, pickHint, confirmLabel,
//           arrangeHint } — subject is the lowercase noun the hints use
//           ("the ghost").
export function makeGraftCard(config) {
  async function begin(ctx) {
    const files = await sampleImages(config.gridSize, ctx.imageList)
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

    // Enter centered in the current working view — the whole canvas
    // normally, the pore region during an enclosure.
    const view = ctx.view ?? { left: 0, top: 0, width: ctx.canvasWidth, height: ctx.canvasHeight }
    const scale = Math.min((view.width * 0.65) / img.width, (view.height * 0.65) / img.height)
    img.set({
      originX: 'center',
      originY: 'center',
      left: view.left + view.width / 2,
      top: view.top + view.height / 2,
      scaleX: scale,
      scaleY: scale,
      globalCompositeOperation: config.blend,
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

  function update(ctx) {
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

  function commit(ctx) {
    // Drop the brush; the blended image stays for the universal bake.
    ctx.session?.session.dispose()
  }

  function cleanup(ctx) {
    const s = ctx.session
    if (!s) return
    s.session.dispose()
    ctx.canvas.remove(s.img)
    ctx.canvas.requestRenderAll()
  }

  // Canvas-area overlay: the grid, only while the pick is open.
  function Overlay({ info }) {
    if (info.stage !== 'pick' || !info.gridFiles) return null
    return (
      <CardGridPicker
        title={config.title}
        hint={config.pickHint}
        files={info.gridFiles}
        confirmLabel={config.confirmLabel}
        onConfirm={(f) => info.pick?.(f)}
      />
    )
  }

  function Tools({ controls, info, ready, onControlChange }) {
    if (info.stage === 'pick') return <span className="hint">Take one image from the grid.</span>
    if (!ready) return <span className="hint">Preparing…</span>
    const brushing = controls.mode !== 'arrange'
    return (
      <div className="brush-tools card-tools">
        <p className="hint">
          {brushing ? maskHint(controls.mode, config.subject) : config.arrangeHint}
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

  return { begin, update, commit, cleanup, Overlay, Tools }
}

// Shared registry shape for graft cards.
export const graftControls = {
  controls: ['opacity', 'brightness', 'contrast', 'mode', 'size', 'hardness', 'strength'],
  defaultControls: {
    opacity: 1,
    brightness: 100,
    contrast: 100,
    mode: 'arrange',
    size: 40,
    hardness: 'soft',
    strength: 1
  }
}
