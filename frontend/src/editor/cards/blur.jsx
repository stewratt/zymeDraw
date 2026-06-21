import * as fabric from 'fabric'

// Layer Blur — Phase 4.5 midgame card.
//
// Same shape as HSV but with one filter instead of three. Switching
// targets reverts the old one; commit leaves the Blur filter baked into
// the chosen image's filters[].

export function beginBlur() {
  return { attachedTo: null, filter: null }
}

export function updateBlur(ctx) {
  const { canvas, controls, session } = ctx
  if (!session) return

  const targetId = controls.targetLayerId || null

  if (session.attachedTo && session.attachedTo !== targetId) {
    detach(canvas, session)
  }

  if (targetId && session.attachedTo !== targetId) {
    attach(canvas, session, targetId, controls)
    return
  }

  if (session.attachedTo && session.filter) {
    session.filter.blur = controls.intensity ?? 0
    const target = findById(canvas, session.attachedTo)
    target?.applyFilters()
    canvas.requestRenderAll()
  }
}

export function commitBlur(ctx) {
  ctx.canvas.requestRenderAll()
}

export function cleanupBlur(ctx) {
  const { canvas, session } = ctx
  if (!session) return
  detach(canvas, session)
  canvas.requestRenderAll()
}

function attach(canvas, session, targetId, controls) {
  const target = findById(canvas, targetId)
  if (!target) return
  const filter = new fabric.filters.Blur({ blur: controls.intensity ?? 0 })
  target.filters = [...(target.filters || []), filter]
  target.applyFilters()
  session.attachedTo = targetId
  session.filter = filter
}

function detach(canvas, session) {
  const old = findById(canvas, session.attachedTo)
  if (old && session.filter) {
    old.filters = (old.filters || []).filter((f) => f !== session.filter)
    old.applyFilters()
  }
  session.attachedTo = null
  session.filter = null
}

function findById(canvas, deckId) {
  return canvas.getObjects().find((o) => o.deckId === deckId)
}

export function BlurTools({ controls, onControlChange }) {
  const hasTarget = !!controls.targetLayerId
  return (
    <div className="pencil-tools">
      <label className="ctrl">
        <span className="ctrl-label">Intensity</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={controls.intensity ?? 0}
          onChange={(e) => onControlChange('intensity', Number(e.target.value))}
        />
        <span className="ctrl-value">{(controls.intensity ?? 0).toFixed(2)}</span>
      </label>
      <p className="hint">
        {hasTarget
          ? 'Adjust the slider; End bakes the blur into the chosen image.'
          : 'Pick an image layer on the right to blur.'}
      </p>
    </div>
  )
}
