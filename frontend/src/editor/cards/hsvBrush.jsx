// HSV Brush — paint a color shift where it belongs. Hue/saturation/
// brightness run through the canvas filter pipeline (hue-rotate/saturate/
// brightness), so dragging the sliders re-renders the shifted copy at
// interactive speed. Note: ctx.filter needs a modern browser (Safari 18+).

import { BrushControls, makeEffectCardHooks } from './effectCardFactory.jsx'

export function hsvFilterString(controls) {
  return `hue-rotate(${controls.h}deg) saturate(${controls.s}%) brightness(${controls.v}%)`
}

export function applyHsvShift(effected, master, controls) {
  const ctx = effected.getContext('2d')
  ctx.save()
  ctx.clearRect(0, 0, effected.width, effected.height)
  ctx.filter = hsvFilterString(controls)
  ctx.drawImage(master, 0, 0)
  ctx.restore()
}

export const hsvBrushHooks = makeEffectCardHooks(applyHsvShift)

// Shared by the HSV brush and the Global HSV card.
export function HsvSliders({ controls, onControlChange }) {
  return (
    <>
      <label className="ctrl">
        <span className="ctrl-label">Hue</span>
        <input
          type="range"
          min="-180"
          max="180"
          value={controls.h}
          onChange={(e) => onControlChange('h', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.h}°</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Saturation</span>
        <input
          type="range"
          min="0"
          max="200"
          value={controls.s}
          onChange={(e) => onControlChange('s', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.s}%</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Brightness</span>
        <input
          type="range"
          min="25"
          max="200"
          value={controls.v}
          onChange={(e) => onControlChange('v', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.v}%</span>
      </label>
    </>
  )
}

export function HsvBrushTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">Set a shift, then paint where it belongs.</p>
      <HsvSliders controls={controls} onControlChange={onControlChange} />
      <BrushControls controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
