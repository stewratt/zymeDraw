// The standing mask brush's shared control blocks.
//
// ArrangeMaskControls — the flat mode row (Arrange · Conceal · Restore ·
// Soften) plus the brush block while a brush op is in hand. Used by every
// card that places one image with the standing brush (Ghost, Stamp, Rails).
// Cards render their own effect sliders (opacity, brightness…) below it.
//
// MaskBrushControls — the brush block on its own, for cards whose brush is
// always in hand (Transfer — nothing to arrange, so no Arrange button; the
// op row still offers conceal/restore/soften).

export const MASK_OP_LABELS = { conceal: 'Conceal', restore: 'Restore', soften: 'Soften' }

// The mode buttons are icons, not words (decided with Stew, 2026-07-04 —
// abstract names were hard to teach). Hovering shows the name; the hint
// line under the row still says what the active mode does.
const MODE_ICONS = {
  // Four-way move arrows.
  arrange: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.8v12.4M1.8 8h12.4" />
        <path d="M6.2 3.6L8 1.8l1.8 1.8M6.2 12.4L8 14.2l1.8-1.8M3.6 6.2L1.8 8l1.8 1.8M12.4 6.2L14.2 8l-1.8 1.8" />
      </g>
    </svg>
  ),
  // An eraser over its wiped line.
  conceal: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.6 2.4l4 4-5.8 5.8H4.6l-2.4-2.4z" />
        <path d="M7.2 4.8l4 4" />
        <path d="M7.5 13.5h6" />
      </g>
    </svg>
  ),
  // A brush laying paint back down.
  restore: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.8 2.2L8.4 7.6" />
        <path d="M8.4 7.6c-1.7-.2-3.2 1-3.4 2.6-.1 1-.6 1.8-1.6 2.3 1.4.9 3.4.9 4.5-.2.8-.8 1.1-1.9.8-3z" fill="currentColor" fillOpacity="0.25" />
      </g>
    </svg>
  ),
  // A dot with a feathered edge.
  soften: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.25" />
    </svg>
  )
}

// One hint sentence per brush op, so every consumer says it the same way.
export function maskHint(mode, subject = 'the image') {
  switch (mode) {
    case 'conceal':
      return `Paint over ${subject} to conceal it.`
    case 'restore':
      return `Paint to bring concealed areas of ${subject} back.`
    case 'soften':
      return 'Paint along a concealed edge to feather it.'
    default:
      return null
  }
}

function OpButtons({ controls, onControlChange, extra = [] }) {
  const ops = [...extra, ...Object.keys(MASK_OP_LABELS)]
  return (
    <div className="mode-toggle icons">
      {ops.map((op) => {
        const label = op === 'arrange' ? 'Arrange' : MASK_OP_LABELS[op]
        return (
          <button
            key={op}
            type="button"
            className={controls.mode === op ? 'active' : ''}
            title={label}
            aria-label={label}
            onClick={() => onControlChange('mode', op)}
          >
            {MODE_ICONS[op]}
          </button>
        )
      })}
    </div>
  )
}

function BrushSliders({ controls, info, onControlChange }) {
  return (
    <>
      <label className="ctrl">
        <span className="ctrl-label">Size</span>
        <input
          type="range"
          min="6"
          max="150"
          value={controls.size}
          onChange={(e) => onControlChange('size', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.size}px</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Strength</span>
        <input
          type="range"
          min="5"
          max="100"
          value={Math.round((controls.strength ?? 1) * 100)}
          onChange={(e) => onControlChange('strength', Number(e.target.value) / 100)}
        />
        <span className="ctrl-value mono">{Math.round((controls.strength ?? 1) * 100)}%</span>
      </label>
      <div className="mode-toggle small">
        <button
          type="button"
          className={controls.hardness === 'soft' ? 'active' : ''}
          onClick={() => onControlChange('hardness', 'soft')}
        >
          Soft
        </button>
        <button
          type="button"
          className={controls.hardness === 'hard' ? 'active' : ''}
          onClick={() => onControlChange('hardness', 'hard')}
        >
          Hard
        </button>
      </div>
      <div className="undo-row">
        <button type="button" className="secondary" disabled={!info.canUndo} onClick={() => info.undo?.()}>
          Undo
        </button>
        <button type="button" className="secondary" disabled={!info.canRedo} onClick={() => info.redo?.()}>
          Redo
        </button>
      </div>
    </>
  )
}

export function MaskBrushControls({ controls, info, onControlChange }) {
  return (
    <>
      <OpButtons controls={controls} onControlChange={onControlChange} />
      <BrushSliders controls={controls} info={info} onControlChange={onControlChange} />
    </>
  )
}

export function ArrangeMaskControls({ controls, info, onControlChange }) {
  const brushing = controls.mode !== 'arrange'
  return (
    <>
      <OpButtons controls={controls} onControlChange={onControlChange} extra={['arrange']} />
      {brushing && <BrushSliders controls={controls} info={info} onControlChange={onControlChange} />}
    </>
  )
}
