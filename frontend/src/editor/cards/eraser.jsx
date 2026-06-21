import { EraserBrush } from '@erase2d/fabric'

// Eraser — Phase 4.2 midgame card.
//
// The user picks ONE committed image layer in the Layers panel (target mode,
// filtered to kind === 'image') and erases on it. Each released stroke is
// committed immediately: pixels are baked out of the target image, never
// kept as a removable clipPath. This matches the project's "no within-card
// undo" rule.
//
// EraserBrush requires Fabric v6's core to NOT ship its own eraser — we use
// the @erase2d/fabric package, which is the maintainer-blessed replacement.
//
// Lifecycle:
//   begin    set every committed object's `erasable` to false, then flip
//            the currently-chosen target to true; create EraserBrush, hook
//            the 'end' event so each stroke calls eraser.commit() with
//            preventDefault() (skipping the non-destructive clipPath path).
//   update   when controls change, re-apply brush size and re-sync which
//            object has erasable=true.
//   commit   detach 'end', drop drawing mode, clear erasable flags.
//   cleanup  same as commit — there is no other ephemeral state to undo.

export function beginEraser(ctx) {
  const { canvas, controls } = ctx

  resetErasable(canvas)
  applyTarget(canvas, controls.targetLayerId)

  const eraser = new EraserBrush(canvas)
  eraser.width = controls.size ?? 30
  canvas.freeDrawingBrush = eraser
  canvas.isDrawingMode = true

  const endHandler = async (e) => {
    // Skip the package's default behavior (apply as a non-destructive
    // clipPath) and bake the stroke into the target image's pixels.
    e.preventDefault()
    const { path, targets } = e.detail
    await eraser.commit({ path, targets })
  }
  const dispose = eraser.on('end', endHandler)

  return { eraser, dispose }
}

export function updateEraser(ctx) {
  const { canvas, controls, session } = ctx
  if (!session?.eraser) return
  session.eraser.width = controls.size ?? 30
  applyTarget(canvas, controls.targetLayerId)
}

export function commitEraser(ctx) {
  const { canvas, session } = ctx
  if (!session) return
  session.dispose?.()
  canvas.isDrawingMode = false
  resetErasable(canvas)
  canvas.requestRenderAll()
}

export function cleanupEraser(ctx) {
  commitEraser(ctx)
}

function resetErasable(canvas) {
  for (const obj of canvas.getObjects()) {
    if (obj.deckId) obj.erasable = false
  }
}

function applyTarget(canvas, targetId) {
  if (!targetId) return
  for (const obj of canvas.getObjects()) {
    if (!obj.deckId) continue
    obj.erasable = obj.deckId === targetId
  }
}

export function EraserTools({ controls, onControlChange, info }) {
  const hasTarget = !!controls.targetLayerId
  return (
    <div className="pencil-tools">
      <label className="ctrl">
        <span className="ctrl-label">Size</span>
        <input
          type="range"
          min={4}
          max={80}
          step={1}
          value={controls.size ?? 30}
          onChange={(e) => onControlChange('size', Number(e.target.value))}
        />
        <span className="ctrl-value">{controls.size ?? 30}px</span>
      </label>
      <p className="hint">
        {hasTarget
          ? 'Drag on the canvas to erase. Each released stroke is permanent. End commits the card.'
          : 'Pick an image layer on the right, then drag on the canvas to erase.'}
      </p>
    </div>
  )
}
