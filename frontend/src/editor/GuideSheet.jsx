// The Guide (issue #75): one sheet that explains the whole system — what
// Deck is, the arc of a session, and the commitment rule — for a hand
// that has never held it. The moment-to-moment already teaches itself
// (phase hints, hover titles, the Keys reference); this covers the whole.
// Same modal manners as KeysReference: while open it swallows the app's
// keys at the capture phase, and Esc or a click anywhere closes it.

import { useEffect } from 'react'
import { UI } from '../copy/uiText.js'
import { rich } from '../copy/rich.jsx'
import './editor.css' // shares the keys-overlay chrome, wherever it's mounted

// Prose lives in the copy file (UI.guide): each section object is a
// "title" plus paragraph entries, in display order.
const SECTIONS = ['what', 'arc', 'commitment', 'bearings'].map((id) => {
  const { title, ...paras } = UI.guide[id]
  return { title, paras: Object.values(paras) }
})

// First-run memory: the editor auto-opens the guide once per machine
// (issue #75). The sheet marks itself seen on mount — not on close — so
// reading it anywhere (Setup included) counts, and a session abandoned
// mid-read doesn't re-summon it. If storage is unavailable, err quiet:
// claim seen rather than greet every launch with the sheet.
const SEEN_KEY = 'deck-guide-seen'
export function guideSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export default function GuideSheet({ onClose }) {
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // No storage — the auto-open simply never quiets on this machine.
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      e.stopPropagation() // the guide is modal: no app key acts behind it
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div className="keys-overlay" onClick={onClose}>
      <div className="keys-panel guide-panel" role="dialog" aria-label="Guide">
        <h2>{UI.guide.title}</h2>
        {SECTIONS.map((section) => (
          <section key={section.title} className="keys-section">
            <h3>{section.title}</h3>
            {section.paras.map((para) => (
              <p key={para} className="guide-para">
                {rich(para)}
              </p>
            ))}
          </section>
        ))}
        <p className="hint">{UI.guide.close}</p>
      </div>
    </div>
  )
}
