import * as fabric from 'fabric'

// Color Grade — Phase 4.7 midgame card.
//
// Per §9 (CLAUDE.md): preset ColorMatrix applied to every IMAGE layer's
// filters[]. Draw (pencil) layers won't receive the grade — known MVP
// limitation; the alternative is flatten-then-grade, which we chose not
// to do because it forces an unwanted Flatten as a side effect.
//
// Lifecycle:
//   begin   nothing visible. Session tracks which image layers we've
//           touched and which ColorMatrix instance we appended to each.
//   update  if the user changes the preset, swap the matrix value in
//           every attached filter. If the preset goes back to 'none',
//           strip the filters we added.
//   commit  leave the filters in place — they're now permanent on
//           every image layer.
//   cleanup strip the filters we added.

const I = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0
]

export const PRESETS = {
  warm: {
    label: 'Warm',
    matrix: [
      1.10, 0.00, 0.00, 0, 0.02,
      0.00, 1.02, 0.00, 0, 0.00,
      0.00, 0.00, 0.85, 0, -0.02,
      0,    0,    0,    1, 0
    ]
  },
  cold: {
    label: 'Cold',
    matrix: [
      0.85, 0.00, 0.00, 0, -0.02,
      0.00, 0.98, 0.00, 0, 0.00,
      0.00, 0.00, 1.15, 0, 0.03,
      0,    0,    0,    1, 0
    ]
  },
  vintage: {
    label: 'Vintage',
    matrix: [
      0.62, 0.32, 0.18, 0, 0.05,
      0.16, 0.78, 0.16, 0, 0.05,
      0.16, 0.32, 0.58, 0, 0.05,
      0,    0,    0,    1, 0
    ]
  },
  bleach: {
    label: 'Bleach',
    matrix: [
      1.20, 0.10, 0.10, 0, 0.05,
      0.10, 1.20, 0.10, 0, 0.05,
      0.10, 0.10, 1.20, 0, 0.05,
      0,    0,    0,    1, 0
    ]
  },
  noir: {
    label: 'Noir',
    matrix: [
      0.33, 0.33, 0.33, 0, -0.05,
      0.33, 0.33, 0.33, 0, -0.05,
      0.33, 0.33, 0.33, 0, -0.05,
      0,    0,    0,    1, 0
    ]
  },
  cinema: {
    label: 'Cinema',
    matrix: [
      1.05, -0.05, 0.00, 0, -0.02,
      -0.02, 1.00, -0.02, 0, 0.00,
      0.00, -0.05, 0.95, 0, 0.02,
      0,    0,    0,    1, 0
    ]
  }
}

export function beginGrade() {
  return { attachedByLayer: new Map() } // deckId → ColorMatrix filter
}

export function updateGrade(ctx) {
  const { canvas, controls, session } = ctx
  if (!session) return
  const preset = controls.preset || null

  if (!preset) {
    detachAll(canvas, session)
    return
  }

  const matrix = PRESETS[preset]?.matrix
  if (!matrix) return

  for (const obj of canvas.getObjects()) {
    if (obj.deckKind !== 'image') continue
    let filter = session.attachedByLayer.get(obj.deckId)
    if (!filter) {
      filter = new fabric.filters.ColorMatrix({ matrix: [...matrix] })
      obj.filters = [...(obj.filters || []), filter]
      session.attachedByLayer.set(obj.deckId, filter)
    } else {
      filter.matrix = [...matrix]
    }
    obj.applyFilters()
  }
  canvas.requestRenderAll()
}

export function commitGrade(ctx) {
  ctx.canvas.requestRenderAll()
}

export function cleanupGrade(ctx) {
  const { canvas, session } = ctx
  if (!session) return
  detachAll(canvas, session)
  canvas.requestRenderAll()
}

function detachAll(canvas, session) {
  for (const [deckId, filter] of session.attachedByLayer.entries()) {
    const obj = canvas.getObjects().find((o) => o.deckId === deckId)
    if (obj) {
      obj.filters = (obj.filters || []).filter((f) => f !== filter)
      obj.applyFilters()
    }
  }
  session.attachedByLayer.clear()
}

export function GradeTools({ controls, onControlChange }) {
  const selected = controls.preset || null
  return (
    <div className="pencil-tools">
      <div className="grade-swatches">
        <SwatchButton
          label="None"
          value={null}
          selected={selected}
          onPick={(v) => onControlChange('preset', v)}
          matrix={I}
        />
        {Object.entries(PRESETS).map(([key, p]) => (
          <SwatchButton
            key={key}
            label={p.label}
            value={key}
            selected={selected}
            onPick={(v) => onControlChange('preset', v)}
            matrix={p.matrix}
          />
        ))}
      </div>
      <p className="hint">
        Preset is applied to every image layer. Draw (pencil) strokes
        are not affected. End bakes the grade in.
      </p>
    </div>
  )
}

function SwatchButton({ label, value, selected, onPick, matrix }) {
  const isSelected = (value || null) === (selected || null)
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

// Build a CSS gradient preview by passing three sample colors through
// the matrix. Lets the user visually compare presets without rendering
// the canvas.
function swatchGradient(matrix) {
  const samples = [
    [220, 60, 60], // red-ish
    [240, 230, 200], // warm light
    [60, 100, 180] // blue-ish
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
