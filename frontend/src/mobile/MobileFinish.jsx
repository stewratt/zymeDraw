// The Coda, on a phone: the piece is finished, and the one thing left is to
// get it off the screen and into Photos.
//
// Two roads, decided by the sink (mobileExport.js) and only reported here:
// the share sheet took it, or it needs the long press. The long-press view is
// the piece at full size on a black field with one sentence under it — press
// and hold, Save to Photos. It opens by itself when the share sheet was never
// available, and stays one tap away otherwise, because a dismissed sheet must
// not cost the piece.

import { useEffect, useState } from 'react'
import Card from '../editor/Card.jsx'
import { UI, fmt } from '../copy/uiText.js'

const T = UI.deckPanel
const M = UI.mobile

function MobileFinish({ card, exportState, onRestart, onBackToIntake }) {
  const { status, via, blobUrl, error, thumbDataUrl } = exportState
  const [pressOpen, setPressOpen] = useState(false)

  // No share sheet on this browser: the long press IS the save, so it opens
  // rather than hiding behind a button nobody was told about.
  useEffect(() => {
    if (status === 'done' && via === 'longpress') setPressOpen(true)
  }, [status, via])

  if (pressOpen && blobUrl) {
    return (
      <div className="m-press">
        <img className="m-press-image" src={blobUrl} alt={T.finishedTitle} />
        <p className="hint m-press-caption">{M.longPressCaption}</p>
        <button type="button" className="secondary" onClick={() => setPressOpen(false)}>
          {M.longPressClose}
        </button>
      </div>
    )
  }

  return (
    <div className="m-finish">
      <h2>{M.savingTitle}</h2>
      <div className="m-finish-body">
        {thumbDataUrl ? (
          <img className="m-finish-thumb" src={thumbDataUrl} alt={T.finishedTitle} />
        ) : (
          card && <Card id={card.id} label={card.label} kind="death" size="tile" />
        )}
        {status === 'exporting' && <p className="hint">{M.sharing}</p>}
        {status === 'done' && via === 'share' && <p className="hint">{M.shared}</p>}
        {status === 'done' && via === 'dismissed' && <p className="hint">{M.shareDismissed}</p>}
        {status === 'error' && <p className="error">{fmt(T.exportFailed, { error })}</p>}
      </div>
      <div className="m-finish-actions">
        {status === 'done' && blobUrl && (
          <button type="button" className="primary" onClick={() => setPressOpen(true)}>
            {M.saveButton}
          </button>
        )}
        <button type="button" className="secondary" onClick={onRestart}>
          {T.restart}
        </button>
        <button type="button" className="link" onClick={onBackToIntake}>
          {M.changeImages}
        </button>
      </div>
    </div>
  )
}

export default MobileFinish
