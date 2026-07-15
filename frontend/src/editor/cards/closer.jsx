// Closer — re-frame the piece, honestly. The same frame session as Deeper
// (frameCardFactory.jsx), but no detail restore: the zoom keeps exactly the
// pixels it magnifies, and enlargement means visible grain. Past a modest
// zoom the re-frame stops interpolating so the grain reads as crisp square
// blocks, not mush — the degradation is texture you compose with.

import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { makeFrameCardHooks } from './frameCardFactory.jsx'

// Below this zoom, blocks wouldn't read as deliberate anyway — smooth.
const CRISP_ZOOM = 2

const hooks = makeFrameCardHooks({
  smoothing: (zoom) => zoom <= CRISP_ZOOM
})

export const beginCloser = hooks.begin
export const commitCloser = hooks.commit
export const cleanupCloser = hooks.cleanup

export function CloserTools({ ready }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="card-tools">
      <p className="hint">
        {CARD_TEXT.closer.description} {UI.cardHints.closer.commitNote}
      </p>
    </div>
  )
}
