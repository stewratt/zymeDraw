// Dissolve — paint where edges should give up their boundary. This is NOT
// the standing soften (which feathers a placed layer's mask edge): Dissolve
// blurs interior content on the baked master itself, a texture-eraser —
// and a strong Deeper companion (dissolve, then dive). One copy in the
// deck, provisional: if soften covers its job in playtests it retires
// (v3 design §6.3).
//
// The blurred copy is drawn with the GPU-accelerated canvas filter, so
// changing the radius is quick. Radius is felt in display pixels and scaled
// up for the master-resolution copy. Note: ctx.filter needs Safari 18+.

import { MASTER_SCALE } from '../masterRaster.js'
import { BrushControls, makeEffectCardHooks } from './effectCardFactory.jsx'

function applyDissolve(effected, master, controls) {
  const ctx = effected.getContext('2d')
  ctx.save()
  ctx.clearRect(0, 0, effected.width, effected.height)
  ctx.filter = `blur(${controls.radius * MASTER_SCALE}px)`
  ctx.drawImage(master, 0, 0)
  ctx.restore()
}

export const dissolveHooks = makeEffectCardHooks(applyDissolve)

export function DissolveTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">Paint where the image should dissolve.</p>
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
