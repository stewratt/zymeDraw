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
    <div className="mode-toggle">
      {ops.map((op) => (
        <button
          key={op}
          type="button"
          className={controls.mode === op ? 'active' : ''}
          onClick={() => onControlChange('mode', op)}
        >
          {op === 'arrange' ? 'Arrange' : MASK_OP_LABELS[op]}
        </button>
      ))}
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
