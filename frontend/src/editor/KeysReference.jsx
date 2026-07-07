// The "Keys" reference (hotkeys.md §7's optional last step): a centered
// overlay listing the whole map, opened from the header's Keys button.
// Purely a reading aid — every key also names itself in its control's
// hover title. While open it swallows the app's keys at the capture phase
// so nothing fires behind it (Enter must not End mid-read); Esc or a
// click anywhere closes it.

import { useEffect } from 'react'
import { UI } from '../copy/uiText.js'

// The section text lives in the copy file (UI.keys): each section object is
// a "title" plus key → description entries, in display order. Only the
// wording lives there — which keys exist is decided here and in keymap.js.
const SECTIONS = ['always', 'brush', 'arranging', 'certainCards', 'atTheCoda'].map((id) => {
  const { title, ...rows } = UI.keys[id]
  return { title, rows: Object.entries(rows) }
})

export default function KeysReference({ onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      e.stopPropagation() // the reference is modal: no app key acts behind it
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div className="keys-overlay" onClick={onClose}>
      <div className="keys-panel" role="dialog" aria-label="Keys">
        <h2>{UI.keys.title}</h2>
        {SECTIONS.map((section) => (
          <section key={section.title} className="keys-section">
            <h3>{section.title}</h3>
            {section.rows.map(([keys, what]) => (
              <div key={keys + what} className="keys-row">
                <kbd>{keys}</kbd>
                <span>{what}</span>
              </div>
            ))}
          </section>
        ))}
        <p className="hint">{UI.keys.close}</p>
      </div>
    </div>
  )
}
