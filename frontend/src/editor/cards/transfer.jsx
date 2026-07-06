// Transfer — the piece is redrawn in another hand. The whole master goes
// through the sidecar's fast-neural-style model (pointillist, for now) and
// comes back as a full-canvas overlay. The judgment is in the taking away:
// an influence slider sets how strongly the redraw sits, and the standing
// mask brush cuts the original back through wherever it should win.
// End bakes whatever remains.
//
// Graceful degradation (mandatory, CLAUDE.md §3): sidecar down or transfer
// failed → no overlay appears, the panel says so, and End simply moves on
// (baking the untouched master changes nothing).

import * as fabric from 'fabric'
import { createMaskSession } from '../brushCore.js'
import { fetchStyledCanvas } from '../styleTransfer.js'
import { MaskBrushControls } from './maskControls.jsx'

export async function beginTransfer(ctx) {
  ctx.report({ stage: 'transferring' })
  let styled = null
  try {
    styled = await fetchStyledCanvas(ctx.master)
  } catch {
    // degrade: no overlay, End moves on
  }
  if (ctx.isCancelled?.()) return null
  if (!styled) {
    ctx.report({ stage: 'work', degraded: true })
    return null
  }

  const img = new fabric.FabricImage(styled, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: ctx.canvasWidth / styled.width,
    scaleY: ctx.canvasHeight / styled.height,
    selectable: false,
    evented: false,
    opacity: ctx.controls.opacity
  })
  ctx.canvas.add(img)
  ctx.canvas.requestRenderAll()

  const controlsRef = { current: ctx.controls }
  const session = createMaskSession(ctx.canvas, [img], {
    getControls: () => controlsRef.current,
    onHistoryChange: (canUndo, canRedo) => ctx.report({ canUndo, canRedo }),
    onSizeChange: (size) => ctx.setControl('size', size)
  })
  // Nothing to arrange — the brush stays in hand for the whole card.
  session.setActive(true)

  ctx.report({
    stage: 'work',
    degraded: false,
    undo: session.undo,
    redo: session.redo,
    canUndo: false,
    canRedo: false
  })
  return { img, session, controlsRef }
}

export function updateTransfer(ctx) {
  const s = ctx.session
  if (!s) return
  s.controlsRef.current = ctx.controls
  s.img.set({ opacity: ctx.controls.opacity })
  ctx.canvas.requestRenderAll()
}

export function commitTransfer(ctx) {
  // Drop the brush; the overlay stays for the universal bake.
  ctx.session?.session.dispose()
}

export function cleanupTransfer(ctx) {
  const s = ctx.session
  if (!s) return
  s.session.dispose()
  ctx.canvas.remove(s.img)
  ctx.canvas.requestRenderAll()
}

export function TransferTools({ controls, info, ready, onControlChange }) {
  if (info.stage === 'transferring' || !ready) {
    return (
      <span className="hint">
        The piece is being redrawn in another hand… a few seconds.
      </span>
    )
  }
  if (info.degraded) {
    return (
      <span className="hint">
        The transfer service is unavailable — the piece stands as it is. End to
        move on.
      </span>
    )
  }
  return (
    <div className="brush-tools card-tools">
      <p className="hint">
        The whole piece has been redrawn. Erase to cut the original back
        through; influence sets how strongly the redraw sits.
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
      <MaskBrushControls controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
