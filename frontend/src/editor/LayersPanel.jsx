import { Fragment, useEffect, useRef, useState } from 'react'
import { getCommittedLayers } from './layers.js'

// The Layers panel is shown next to the deck panel for cards that need a
// per-layer choice. It has four modes:
//
//   slot    — Pencil: pick where to insert the new draw layer (Top / between
//             two existing layers / Bottom).
//   target  — Eraser, Layer HSV, Layer Blur, Remove Layer: pick a single
//             layer to operate on.
//   reorder — Add cards: drag layers to reorder the whole stack. Persists the
//             top-down order into controls.layerOrder; the Add card's update
//             hook applies it to the canvas.
//   display — Shuffle: read-only stack view that re-reads the live canvas
//             order after each reroll. No interaction.

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
  if (mode === 'reorder') {
    return <ReorderPicker layers={layers} thumbs={thumbs} onControlChange={onControlChange} />
  }
  if (mode === 'display') {
    return <DisplayPicker layers={layers} thumbs={thumbs} controls={controls} />
  }
  return null
}

function DisplayPicker({ layers, thumbs, controls }) {
  // Read-only mirror of the live stack, for Shuffle. The card reorders the
  // canvas inside its own update hook, which runs *after* this component
  // renders (child effects fire before the parent's), so a render-time read
  // would show the previous order. We re-read one animation frame after each
  // control change, by which point the reroll has landed on the canvas.
  const canvas = layers[0]?.object?.canvas || null
  const readView = () =>
    canvas ? getCommittedLayers(canvas).slice().reverse() : layers.slice().reverse()

  const [view, setView] = useState(readView)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setView(readView()))
    return () => cancelAnimationFrame(raf)
  }, [controls, canvas])

  return (
    <aside className="layers-panel">
      <h3>LAYER STACK</h3>
      <p className="hint">Current order (top = front). Shuffle again to reroll.</p>
      <div className="display-stack">
        {view.map((layer) => (
          <LayerChip key={layer.id} layer={layer} thumb={thumbs[layer.id]} />
        ))}
      </div>
    </aside>
  )
}

function ReorderPicker({ layers, thumbs, onControlChange }) {
  // The panel owns its own top-down order. The `layers` prop is captured at
  // begin and is NOT a reliable mid-card source, so we seed local order from
  // it and only re-seed when the underlying set of layer ids changes (a new
  // card / a new stack) — never on every render, which would clobber an
  // in-progress drag.
  const [order, setOrder] = useState(() => topDownIds(layers))
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  const sig = layers.map((l) => l.id).sort().join('|')
  const lastSig = useRef(sig)
  useEffect(() => {
    if (sig === lastSig.current) return
    lastSig.current = sig
    setOrder(topDownIds(layers))
  }, [sig, layers])

  const byId = new Map(layers.map((l) => [l.id, l]))

  function reorder(next) {
    setOrder(next)
    onControlChange('layerOrder', next)
  }

  function handleDrop(targetId) {
    setOverId(null)
    if (!dragId || dragId === targetId) {
      setDragId(null)
      return
    }
    const from = order.indexOf(dragId)
    const to = order.indexOf(targetId)
    const next = order.filter((id) => id !== dragId)
    const idx = next.indexOf(targetId)
    // Direction-aware drop: dragging down (item started above the target)
    // lands it below the target; dragging up lands it above. Without this the
    // insert is always "above target", so downward drags stall or no-op.
    const insertAt = from < to ? idx + 1 : idx
    next.splice(insertAt, 0, dragId)
    setDragId(null)
    reorder(next)
  }

  return (
    <aside className="layers-panel">
      <h3>LAYER STACK</h3>
      <p className="hint">Drag to reorder. Top of the list is the front.</p>
      <div className="reorder-stack">
        {order.map((id) => {
          const layer = byId.get(id)
          if (!layer) return null
          return (
            <div
              key={id}
              className={`layer-row reorder-row ${dragId === id ? 'dragging' : ''} ${overId === id ? 'drag-over' : ''}`}
              draggable
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => {
                e.preventDefault()
                if (overId !== id) setOverId(id)
              }}
              onDragLeave={() => setOverId((cur) => (cur === id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(id)
              }}
              onDragEnd={() => {
                setDragId(null)
                setOverId(null)
              }}
            >
              <span className="drag-handle" aria-hidden="true">⠿</span>
              {thumbs[id] ? <img src={thumbs[id]} alt="" /> : <div className="thumb-placeholder" />}
              <span className="layer-label">
                <small className="kind">{layer.kind}</small>
                {layer.label}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

// canvas-order is bottom-first; the panel shows + stores top-down (front first).
function topDownIds(layers) {
  return layers.slice().reverse().map((l) => l.id)
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
