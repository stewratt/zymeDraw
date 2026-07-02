// Blur Brush — paint softness where it belongs. The blurred copy is drawn
// with the GPU-accelerated canvas filter, so changing the radius is quick.
//
// Radius is felt in display pixels and scaled up for the master-resolution
// copy. Note: ctx.filter needs a modern browser (Safari 18+).

import { MASTER_SCALE } from '../masterRaster.js'
import { BrushControls, makeEffectCardHooks } from './effectCardFactory.jsx'

function applyBlur(effected, master, controls) {
  const ctx = effected.getContext('2d')
  ctx.save()
  ctx.clearRect(0, 0, effected.width, effected.height)
  ctx.filter = `blur(${controls.radius * MASTER_SCALE}px)`
  ctx.drawImage(master, 0, 0)
  ctx.restore()
}

export const blurHooks = makeEffectCardHooks(applyBlur)

export function BlurTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">Paint where the image should soften.</p>
      <label className="ctrl">
        <span className="ctrl-label">Radius</span>
        <input
          type="range"
          min="2"
          max="40"
          value={controls.radius}
          onChange={(e) => onControlChange('radius', Number(e.target.value))}
        />
        <span className="ctrl-value mono">{controls.radius}px</span>
      </label>
      <BrushControls controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
