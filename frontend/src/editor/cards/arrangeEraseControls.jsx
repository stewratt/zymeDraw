// The Arrange/Erase control block shared by cards that place one image
// with the standing erase brush (Ghost, Stamp): the mode toggle, and the
// brush controls + undo/redo while erasing. Cards render their own effect
// sliders (opacity, brightness…) below it.

export function ArrangeEraseControls({ controls, info, onControlChange }) {
  const erasing = controls.mode === 'erase'
  return (
    <>
      <div className="mode-toggle">
        <button
          type="button"
          className={erasing ? '' : 'active'}
          onClick={() => onControlChange('mode', 'arrange')}
        >
          Arrange
        </button>
        <button
          type="button"
          className={erasing ? 'active' : ''}
          onClick={() => onControlChange('mode', 'erase')}
        >
          Erase
        </button>
      </div>
      {erasing && (
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
      )}
    </>
  )
}
