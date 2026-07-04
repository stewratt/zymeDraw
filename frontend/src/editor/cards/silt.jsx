// Silt — fine particulate settles where you paint. Nothing changes until
// you paint. Built on the effect-card factory; this file is only the grain
// itself plus its Tools panel. (Deck anatomy: Reveal × deposit — and the
// canonical deposit card: a later Deeper texturizes the settled grain into
// real sediment.)

import { BrushControls, makeEffectCardHooks } from './effectCardFactory.jsx'

// Monochrome grain at full strength: ±STRENGTH per pixel, same offset for
// R/G/B so the grain reads as film, not confetti. Influence blends it down.
const STRENGTH = 90

function applySilt(effected, master) {
  const ctx = effected.getContext('2d')
  ctx.clearRect(0, 0, effected.width, effected.height)
  ctx.drawImage(master, 0, 0)
  const imageData = ctx.getImageData(0, 0, effected.width, effected.height)
  const px = imageData.data
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * STRENGTH
    px[i] += n
    px[i + 1] += n
    px[i + 2] += n
  }
  ctx.putImageData(imageData, 0, 0)
}

export const siltHooks = makeEffectCardHooks(applySilt)

export function SiltTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">Preparing the silt…</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">Paint where the silt should settle. Nothing changes until you paint.</p>
      <BrushControls controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
