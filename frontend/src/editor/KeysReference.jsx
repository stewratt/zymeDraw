// The "Keys" reference (hotkeys.md §7's optional last step): a centered
// overlay listing the whole map, opened from the header's Keys button.
// Purely a reading aid — every key also names itself in its control's
// hover title. While open it swallows the app's keys at the capture phase
// so nothing fires behind it (Enter must not End mid-read); Esc or a
// click anywhere closes it.

import { useEffect } from 'react'

const SECTIONS = [
  {
    title: 'Always',
    rows: [
      ['Enter', 'The primary action — End, Deal, begin again. Never confirms the opening pick.'],
      ['Space', 'Deal.'],
      ['Shift+R', 'Restart. It destroys the piece, so it takes two keys.'],
      ['Esc', 'Back out: deselect, put a grid pick back, close this.']
    ]
  },
  {
    title: 'Brush in hand',
    rows: [
      ['[ ]', 'Brush size, steps of 5 — 10 with Shift. Shift+drag on the canvas also resizes.'],
      ['W', 'Arrange — where there is something to arrange.'],
      ['E', 'Erase.'],
      ['R', 'Restore.'],
      ['S', 'Soften.'],
      ['X', 'Swap Erase ↔ Restore.'],
      ['H', 'Soft / hard.'],
      ['Cmd/Ctrl+Z', 'Undo a stroke — add Shift to redo. Never crosses an End.']
    ]
  },
  {
    title: 'Arranging',
    rows: [
      ['Arrows', 'Nudge 1px — 10 with Shift.'],
      [', .', 'Rotate 1° — 15° with Shift.'],
      ['- =', 'Scale 2% — 10% with Shift.']
    ]
  },
  {
    title: 'On certain cards',
    rows: [
      ['Enter', 'Confirm a grid pick. Etch: zoom in.'],
      ['[ ]', 'Etch: pixel size.'],
      ['N', 'A new hue on any color control.']
    ]
  }
]

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
        <h2>KEYS</h2>
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
        <p className="hint">Click anywhere or press Esc to close.</p>
      </div>
    </div>
  )
}
