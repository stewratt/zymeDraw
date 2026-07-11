// Dust — fine particulate settles where you paint. Nothing changes until
// you paint. Built on the effect-card factory; this file is only the grain
// itself plus its Tools panel. (Deck anatomy: Reveal × deposit — and the
// canonical deposit card: a later Deeper texturizes the settled grain into
// real sediment.) (id `dust`, was Silt.)

import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { MASTER_SCALE } from '../masterRaster.js'
import { BrushControls, makeEffectCardHooks } from './effectCardFactory.jsx'

// Monochrome grain at full strength: ±STRENGTH per grain, same offset for
// R/G/B so the grain reads as film, not confetti. Influence blends it down.
const STRENGTH = 90

// One grain per DISPLAY pixel (a MASTER_SCALE × MASTER_SCALE master block),
// like Blur's radius: per-master-pixel grain is all high frequency, so the
// working canvas's 1/3-scale draw averaged it to ~a third of its amplitude
// while the bake kept it 1:1 — the export came out far grainier than the
// preview (issue #40). Block grain survives the downscale at full strength,
// so the editor shows what the bake commits.
function applyDust(effected, master) {
  const ctx = effected.getContext('2d')
  ctx.clearRect(0, 0, effected.width, effected.height)
  ctx.drawImage(master, 0, 0)
  const { width, height } = effected
  const cols = Math.ceil(width / MASTER_SCALE)
  const grain = new Float32Array(cols * Math.ceil(height / MASTER_SCALE))
  for (let i = 0; i < grain.length; i++) grain[i] = (Math.random() - 0.5) * 2 * STRENGTH
  const imageData = ctx.getImageData(0, 0, width, height)
  const px = imageData.data
  for (let y = 0; y < height; y++) {
    const row = ((y / MASTER_SCALE) | 0) * cols
    for (let x = 0; x < width; x++) {
      const n = grain[row + ((x / MASTER_SCALE) | 0)]
      const p = (y * width + x) * 4
      px[p] += n
      px[p + 1] += n
      px[p + 2] += n
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

export const dustHooks = makeEffectCardHooks(applyDust)

export function DustTools({ controls, info, ready, onControlChange }) {
  if (!ready) return <span className="hint">{UI.cardHints.dust.preparing}</span>
  return (
    <div className="brush-tools card-tools">
      <p className="hint">{CARD_TEXT.dust.description}</p>
      <BrushControls controls={controls} info={info} onControlChange={onControlChange} />
    </div>
  )
}
