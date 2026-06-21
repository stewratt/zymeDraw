import { Fragment, useEffect, useState } from 'react'

// The Layers panel is shown next to the deck panel for cards that need a
// per-layer choice. It has two modes:
//
//   slot   — Pencil: pick where to insert the new draw layer (Top / between
//            two existing layers / Bottom).
//   target — (future) Eraser, Layer HSV, Layer Blur: pick a single layer
//            to operate on. Wired up here but no consumer yet.

function LayersPanel({ mode, layers, controls, onControlChange }) {
  // Generate thumbnails for each layer when the layer set changes. Each is
  // just the Fabric object rendered to a small PNG data URL.
  const [thumbs, setThumbs] = useState({})
  useEffect(() => {
    const next = {}
    for (const l of layers) {
      try {
        next[l.id] = l.object.toDataURL({ multiplier: 0.18 })
      } catch (err) {
        // toDataURL can throw on objects with no real bounding box (e.g. a
        // brand-new empty Group). Skipping the thumbnail is fine.
      }
    }
    setThumbs(next)
  }, [layers])

  if (mode === 'slot') {
    return <SlotPicker layers={layers} thumbs={thumbs} controls={controls} onControlChange={onControlChange} />
  }
  if (mode === 'target') {
    return <TargetPicker layers={layers} thumbs={thumbs} controls={controls} onControlChange={onControlChange} />
  }
  return null
}

function SlotPicker({ layers, thumbs, controls, onControlChange }) {
  // canvas-order is bottom-first; display is top-down.
  const topDown = layers.slice().reverse()
  const selected = controls.insertAt || 'top'
  const pick = (value) => onControlChange('insertAt', value)

  return (
    <aside className="layers-panel">
      <h3>LAYER STACK</h3>
      <p className="hint">Pick where the new drawing goes.</p>
      <div className="slot-stack">
        <SlotChip label="Top of stack" value="top" selected={selected} onPick={pick} />
        {topDown.map((layer, i) => (
          <Fragment key={layer.id}>
            <LayerChip layer={layer} thumb={thumbs[layer.id]} />
            {i < topDown.length - 1 && (
              <SlotChip
                label="Between"
                value={`above:${topDown[i + 1].id}`}
                selected={selected}
                onPick={pick}
              />
            )}
          </Fragment>
        ))}
        <SlotChip label="Bottom of stack" value="bottom" selected={selected} onPick={pick} />
      </div>
    </aside>
  )
}

function TargetPicker({ layers, thumbs, controls, onControlChange }) {
  const topDown = layers.slice().reverse()
  const selected = controls.targetLayerId
  const pick = (id) => onControlChange('targetLayerId', id)

  return (
    <aside className="layers-panel">
      <h3>TARGET LAYER</h3>
      <p className="hint">Pick which layer this card operates on.</p>
      <div className="target-stack">
        {topDown.map((layer) => (
          <label key={layer.id} className={`layer-row clickable ${selected === layer.id ? 'selected' : ''}`}>
            <input
              type="radio"
              name="target"
              checked={selected === layer.id}
              onChange={() => pick(layer.id)}
            />
            {thumbs[layer.id] ? <img src={thumbs[layer.id]} alt="" /> : <div className="thumb-placeholder" />}
            <span className="layer-label">
              <small className="kind">{layer.kind}</small>
              {layer.label}
            </span>
          </label>
        ))}
      </div>
    </aside>
  )
}

function SlotChip({ label, value, selected, onPick }) {
  return (
    <label className={`slot-chip ${selected === value ? 'selected' : ''}`}>
      <input
        type="radio"
        name="slot"
        checked={selected === value}
        onChange={() => onPick(value)}
      />
      <span>{label}</span>
    </label>
  )
}

function LayerChip({ layer, thumb }) {
  return (
    <div className="layer-row">
      {thumb ? <img src={thumb} alt="" /> : <div className="thumb-placeholder" />}
      <span className="layer-label">
        <small className="kind">{layer.kind}</small>
        {layer.label}
      </span>
    </div>
  )
}

export default LayersPanel
