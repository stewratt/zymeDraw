// A card, larger: the click-to-inspect overlay. Same modal manners as the
// other sheets (swallows app keys at the capture phase; Esc or a click
// anywhere closes it) but it only ever closes itself — when opened from
// inside the deck overlay it sits above it (z-index) and clicking through
// is stopped, so the sheet underneath stays open.

import { useEffect } from 'react'
import Card from './Card.jsx'

export default function CardZoom({ id, label, kind = 'mod', onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div
      className="card-zoom-overlay"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="card-zoom">
        <Card id={id} label={label} kind={kind} size="zoom" />
        <span className="card-name">{label}</span>
      </div>
    </div>
  )
}
