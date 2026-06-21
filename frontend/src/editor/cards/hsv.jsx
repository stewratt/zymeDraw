import * as fabric from 'fabric'

// Layer HSV — Phase 4.4 midgame card.
//
// Three sliders (H, S, V) operating on a single image layer (target mode,
// image-only). Within the card, switching targets is reversible: we strip
// the filters we attached and put them on the new target. On End the
// filters stay baked into the target image's filters[] array — Fabric
// re-applies them on every render, so they become a permanent part of
// that image until a Flatten card collapses everything.
//
// V = Fabric's Brightness (additive lightness). Not a true HSV V, but
// close enough visually for this game.

const SLIDER_DEFAULTS = { h: 0, s: 0, v: 0 }

export function beginHsv() {
  // No filters attached until the user picks a target. We can't pick a
  // default target because the layer set could be empty (e.g. all draw
  // layers). Empty target = no-op card.
  return { attachedTo: null, filters: null }
}

export function updateHsv(ctx) {
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

  if (session.attachedTo && session.filters) {
    session.filters.hue.rotation = (controls.h ?? 0) / 180
    session.filters.sat.saturation = controls.s ?? 0
    session.filters.bright.brightness = controls.v ?? 0
    const target = findById(canvas, session.attachedTo)
    target?.applyFilters()
    canvas.requestRenderAll()
  }
}

export function commitHsv(ctx) {
  // Leave filters attached on the current target. They're now part of
  // the image's permanent filter stack.
  ctx.canvas.requestRenderAll()
}

export function cleanupHsv(ctx) {
  // Restart path: strip the filters we added so the canvas reflects no
  // change from this card.
  const { canvas, session } = ctx
  if (!session) return
  detach(canvas, session)
  canvas.requestRenderAll()
}

function attach(canvas, session, targetId, controls) {
  const target = findById(canvas, targetId)
  if (!target) return
  const hue = new fabric.filters.HueRotation({ rotation: (controls.h ?? 0) / 180 })
  const sat = new fabric.filters.Saturation({ saturation: controls.s ?? 0 })
  const bright = new fabric.filters.Brightness({ brightness: controls.v ?? 0 })
  target.filters = [...(target.filters || []), hue, sat, bright]
  target.applyFilters()
  // The target-switch path runs here, not through the slider branch, so it
  // must repaint itself or the new target's filters won't show until a jiggle.
  canvas.requestRenderAll()
  session.attachedTo = targetId
  session.filters = { hue, sat, bright }
}

function detach(canvas, session) {
  const old = findById(canvas, session.attachedTo)
  if (old && session.filters) {
    const ours = new Set([session.filters.hue, session.filters.sat, session.filters.bright])
    old.filters = (old.filters || []).filter((f) => !ours.has(f))
    old.applyFilters()
    // Repaint so the old target reverts immediately on a target switch
    // (cleanup also repaints after this; requestRenderAll coalesces).
    canvas.requestRenderAll()
  }
  session.attachedTo = null
  session.filters = null
}

function findById(canvas, deckId) {
  return canvas.getObjects().find((o) => o.deckId === deckId)
}

export function HsvTools({ controls, onControlChange }) {
  const hasTarget = !!controls.targetLayerId
  return (
    <div className="pencil-tools">
      <Slider
        label="H"
        unit="°"
        min={-180}
        max={180}
        step={1}
        value={controls.h ?? SLIDER_DEFAULTS.h}
        onChange={(v) => onControlChange('h', v)}
      />
      <Slider
        label="S"
        min={-1}
        max={1}
        step={0.01}
        value={controls.s ?? SLIDER_DEFAULTS.s}
        onChange={(v) => onControlChange('s', v)}
      />
      <Slider
        label="V"
        min={-1}
        max={1}
        step={0.01}
        value={controls.v ?? SLIDER_DEFAULTS.v}
        onChange={(v) => onControlChange('v', v)}
      />
      <p className="hint">
        {hasTarget
          ? 'Adjust hue, saturation, and lightness on the chosen image. End bakes the change in.'
          : 'Pick an image layer on the right to grade.'}
      </p>
    </div>
  )
}

function Slider({ label, unit = '', min, max, step, value, onChange }) {
  return (
    <label className="ctrl">
      <span className="ctrl-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="ctrl-value">{format(value)}{unit}</span>
    </label>
  )
}

function format(v) {
  if (Number.isInteger(v)) return v
  return v.toFixed(2)
}
