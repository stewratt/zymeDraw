// The ground (issue #115): the color of the canvas beneath the opening
// placement. An image that isn't fullscreened used to sit on white with no
// say in it; this lets the opening choose what the surround is.
//
// The control is only the choosing — Editor paints it onto the master, so
// the ground is ordinary master pixels from the first draw onward, not a
// property anything downstream has to remember (masterRaster.fillMaster).

import { UI } from '../copy/uiText.js'

const T = UI.ground

export const GROUND_DEFAULT = '#ffffff'

// Curated, not a rainbow: two paper whites, two greys, a black, three muted
// tones — grounds a collage can sit on. The id is the permanent key (its
// name is copy, UI.ground.names); the hex is the value.
export const GROUND_SWATCHES = [
  { id: 'paper', hex: '#ffffff' },
  { id: 'bone', hex: '#f2ece0' },
  { id: 'ash', hex: '#cfccc5' },
  { id: 'slate', hex: '#6e7378' },
  { id: 'ink', hex: '#14161a' },
  { id: 'clay', hex: '#b4886b' },
  { id: 'moss', hex: '#77836a' },
  { id: 'indigo', hex: '#3c4560' }
]

function GroundPicker({ color, onChange }) {
  return (
    <div className="ground-block">
      <span className="ctrl-label">{T.title}</span>
      <div className="ground-swatches">
        {GROUND_SWATCHES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`ground-swatch${color.toLowerCase() === s.hex ? ' selected' : ''}`}
            style={{ background: s.hex }}
            title={T.names[s.id]}
            aria-label={T.names[s.id]}
            onClick={() => onChange(s.hex)}
          />
        ))}
      </div>
      <label className="ctrl">
        <span className="ctrl-label">{T.custom}</span>
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} />
        <span className="ctrl-value mono">{color}</span>
      </label>
      <p className="hint">{T.hint}</p>
    </div>
  )
}

export default GroundPicker
