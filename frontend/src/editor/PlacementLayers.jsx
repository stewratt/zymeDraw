// The placement layers panel — a Photoshop-style stack of the images being
// placed right now (opening or stash return). Each row shows a thumbnail and
// filename; when two or more images are in play the rows are draggable to
// reorder the canvas stack. With a single image there is nothing to reorder,
// so rows are static.
//
// Order here is top-to-bottom (topmost layer first), matching how a layers
// panel reads. Editor owns the reorder — it restacks the Fabric objects and
// keeps this list in sync (see handleReorderLayer). The erase brush always
// targets the topmost image under the pointer, so reordering here also
// changes which image a stroke sticks to, for free.

import { useState } from 'react'

function PlacementLayers({ layers, onReorder }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const canDrag = layers.length >= 2

  function reset() {
    setDragIndex(null)
    setOverIndex(null)
  }

  function onDrop(to) {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to)
    reset()
  }

  return (
    <ul className="placed-layers">
      {layers.map((layer, i) => (
        <li
          key={layer.id}
          className={
            'layer-row' +
            (canDrag ? ' draggable' : '') +
            (overIndex === i && dragIndex !== null ? ' drop-target' : '') +
            (dragIndex === i ? ' dragging' : '')
          }
          draggable={canDrag}
          onDragStart={(e) => {
            // Mark this a move, not a copy — kills the green "+" cursor.
            e.dataTransfer.effectAllowed = 'move'
            setDragIndex(i)
          }}
          onDragOver={(e) => {
            if (!canDrag) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setOverIndex(i)
          }}
          onDrop={() => onDrop(i)}
          onDragEnd={reset}
        >
          {/* draggable={false}: the row is the drag source, not the image
              itself (which would trigger the browser's copy-image behavior). */}
          <img className="layer-thumb" src={layer.thumb} alt="" draggable={false} />
          <span className="layer-name">{layer.name}</span>
        </li>
      ))}
    </ul>
  )
}

export default PlacementLayers
