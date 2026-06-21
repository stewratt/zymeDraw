import * as fabric from 'fabric'

// Final Grade — Phase 5 endgame card.
//
// Strong global color-grade + a slight contrast bump applied to every
// image layer. Same pattern as the midgame Color Grade card: append our
// filters to each image's filters[], swap matrices on preset change,
// strip on cleanup. Commit leaves them in place — they become part of
// each image's permanent filter stack and the export pipeline picks it up.

const PRESETS = {
  cinema: {
    label: 'Cinema',
    matrix: [
      1.05, -0.05, 0.00, 0, -0.04,
      -0.02, 1.00, -0.02, 0, 0.00,
      0.00, -0.05, 0.95, 0, 0.04,
      0,    0,    0,    1, 0
    ],
    contrast: 0.15
  },
  hollywood: {
    label: 'Hollywood',
    matrix: [
      1.15, 0.05, 0.00, 0, 0.02,
      0.05, 1.05, 0.05, 0, 0.02,
      0.00, 0.05, 0.85, 0, -0.04,
      0,    0,    0,    1, 0
    ],
    contrast: 0.20
  },
  bleached: {
    label: 'Bleached',
    matrix: [
      0.90, 0.10, 0.10, 0, 0.06,
      0.10, 0.90, 0.10, 0, 0.06,
      0.10, 0.10, 0.90, 0, 0.06,
      0,    0,    0,    1, 0
    ],
    contrast: 0.10
  }
}

const DEFAULT_PRESET = 'cinema'

export function beginFinalGrade(ctx) {
  // Pre-apply the default preset so the canvas shows something the moment
  // the card is drawn. Subsequent preset changes mutate the same filter
  // instances we just attached.
  const session = { attachedByLayer: new Map() } // deckId → { color, contrast }
  const preset = ctx.controls.preset || DEFAULT_PRESET
  applyPreset(ctx.canvas, session, preset)
  return session
}

export function updateFinalGrade(ctx) {
  const { canvas, controls, session } = ctx
  if (!session) return
  const preset = controls.preset || DEFAULT_PRESET
  applyPreset(canvas, session, preset)
}

export function commitFinalGrade(ctx) {
  ctx.canvas.requestRenderAll()
}

export function cleanupFinalGrade(ctx) {
  const { canvas, session } = ctx
  if (!session) return
  detachAll(canvas, session)
  canvas.requestRenderAll()
}

function applyPreset(canvas, session, presetKey) {
  const preset = PRESETS[presetKey]
  if (!preset) return
  for (const obj of canvas.getObjects()) {
    if (obj.deckKind !== 'image') continue
    let attached = session.attachedByLayer.get(obj.deckId)
    if (!attached) {
      const color = new fabric.filters.ColorMatrix({ matrix: [...preset.matrix] })
      const contrast = new fabric.filters.Contrast({ contrast: preset.contrast })
      obj.filters = [...(obj.filters || []), color, contrast]
      attached = { color, contrast }
      session.attachedByLayer.set(obj.deckId, attached)
    } else {
      attached.color.matrix = [...preset.matrix]
      attached.contrast.contrast = preset.contrast
    }
    obj.applyFilters()
  }
  canvas.requestRenderAll()
}

function detachAll(canvas, session) {
  for (const [deckId, attached] of session.attachedByLayer.entries()) {
    const obj = canvas.getObjects().find((o) => o.deckId === deckId)
    if (obj) {
      obj.filters = (obj.filters || []).filter(
        (f) => f !== attached.color && f !== attached.contrast
      )
      obj.applyFilters()
    }
  }
  session.attachedByLayer.clear()
}

export function FinalGradeTools({ controls, onControlChange }) {
  const selected = controls.preset || DEFAULT_PRESET
  return (
    <div className="pencil-tools">
      <div className="grade-swatches">
        {Object.entries(PRESETS).map(([key, p]) => (
          <Swatch
            key={key}
            label={p.label}
            value={key}
            selected={selected}
            onPick={(v) => onControlChange('preset', v)}
            matrix={p.matrix}
          />
        ))}
      </div>
      <p className="hint">End commits the grade and exports the composition.</p>
    </div>
  )
}

function Swatch({ label, value, selected, onPick, matrix }) {
  const isSelected = value === selected
  return (
    <button
      type="button"
      className={`grade-swatch ${isSelected ? 'selected' : ''}`}
      onClick={() => onPick(value)}
      title={label}
    >
      <span className="swatch-chip" style={{ background: swatchGradient(matrix) }} />
      <span className="swatch-label">{label}</span>
    </button>
  )
}

function swatchGradient(matrix) {
  const samples = [
    [220, 60, 60],
    [240, 230, 200],
    [60, 100, 180]
  ]
  const cols = samples.map((rgb) => applyMatrix(rgb, matrix))
  return `linear-gradient(135deg, ${cols.map(rgbCss).join(', ')})`
}
function applyMatrix(rgb, m) {
  const [r, g, b] = rgb.map((v) => v / 255)
  const nr = clamp01(m[0] * r + m[1] * g + m[2] * b + m[4])
  const ng = clamp01(m[5] * r + m[6] * g + m[7] * b + m[9])
  const nb = clamp01(m[10] * r + m[11] * g + m[12] * b + m[14])
  return [nr * 255, ng * 255, nb * 255]
}
function clamp01(x) { return Math.max(0, Math.min(1, x)) }
function rgbCss([r, g, b]) { return `rgb(${r | 0}, ${g | 0}, ${b | 0})` }
