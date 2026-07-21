// The Guide (issue #75): one paged sheet for the whole system — the
// session, the deck editor, the foundry, and setup each get a page.
// Every guide button opens it to its own area's page; the page names
// across the top reach the rest, so the whole manual is readable from
// anywhere. The moment-to-moment still teaches itself (phase hints,
// hover titles, the Keys reference); this covers the wholes.
//
// Modal manners: while open it swallows the app's keys at the capture
// phase. Unlike KeysReference, the panel itself is clickable (page
// names), so click-anywhere-closes narrows to backdrop, Esc, or the ×.

import { useEffect, useState } from 'react'
import { UI } from '../copy/uiText.js'
import { rich } from '../copy/rich.jsx'
import './editor.css' // shares the keys-overlay chrome, wherever it's mounted

// Prose lives in the copy file (UI.guide): one object per page — a
// "label" plus section objects, each a "title" plus paragraph entries,
// all in display order.
const PAGE_IDS = ['session', 'deckEditor', 'foundry', 'setup']
const PAGES = Object.fromEntries(
  PAGE_IDS.map((id) => {
    const { label, ...sections } = UI.guide[id]
    return [
      id,
      {
        label,
        sections: Object.values(sections).map(({ title, ...paras }) => ({
          title,
          paras: Object.values(paras)
        }))
      }
    ]
  })
)

// First-run memory, per page: each area auto-opens its page once per
// machine. A page counts as seen when it is actually on screen — flipping
// to the foundry page from Setup quiets the foundry's own first visit.
// If storage is unavailable, err quiet: claim seen rather than greet
// every launch with the sheet.
const seenKey = (page) => `zyme-guide-seen:${page}`
export function guideSeen(page) {
  try {
    return localStorage.getItem(seenKey(page)) === '1'
  } catch {
    return true
  }
}

export default function GuideSheet({ page = 'session', onClose }) {
  const [active, setActive] = useState(page)

  useEffect(() => {
    try {
      localStorage.setItem(seenKey(active), '1')
    } catch {
      // No storage — the auto-open simply never quiets on this machine.
    }
  }, [active])

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
      <div className="keys-panel guide-panel" role="dialog" aria-label="Guide" onClick={(e) => e.stopPropagation()}>
        <div className="guide-header">
          <h2>{UI.guide.title}</h2>
          <button type="button" className="link guide-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <nav className="guide-pages">
          {PAGE_IDS.map((id) => (
            <button
              type="button"
              key={id}
              className={`link guide-page-tab${id === active ? ' active' : ''}`}
              onClick={() => setActive(id)}
            >
              {PAGES[id].label}
            </button>
          ))}
        </nav>
        {PAGES[active].sections.map((section) => (
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
