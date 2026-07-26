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

// `committed` flips once the Zoom In button has run the re-frame (issue #92):
// the description stands either way, but the round changes under it — before,
// the frame is live and the draw would let the card pass; after, the re-frame
// is in the piece and the draw is only the next deal.
export function CloserTools({ ready, committed }) {
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="card-tools">
      <p className="hint">
        {CARD_TEXT.closer.description}{' '}
        {committed
          ? UI.cardGate.committedNote
          : `${UI.cardHints.closer.commitNote} ${UI.cardGate.passNote}`}
      </p>
    </div>
  )
}
