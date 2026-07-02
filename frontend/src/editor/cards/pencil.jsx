import * as fabric from 'fabric'

// Pencil — RETAINED v1 REFERENCE CODE, not registered and not drawable.
// Kept on disk as the starting point for the v2 universal brush core
// (Phase 3b): free-drawing setup, stroke collection, live control updates.
// Delete once the brush core lands.
//
// Original notes (v1 Phase 4 first midgame card):
//
// Lifecycle:
//   begin    enables freeDrawingMode with the default brush, attaches a
//            path:created listener that collects every stroke into an array.
//   update   re-applies brush size/color when the user changes the slider
//            or picks a new color.
//   commit   stops drawing, wraps the collected paths in a fabric.Group,
//            inserts the group at the chosen stack slot, locks it.
//   cleanup  used only when the user abandons the card (restart): detaches
//            the listener, removes any in-flight paths, drops drawing mode.

let nextDrawingNumber = 1

export function beginPencil(ctx) {
  const { canvas, controls } = ctx

  const brush = new fabric.PencilBrush(canvas)
  brush.width = controls.size
  brush.color = controls.color
  canvas.freeDrawingBrush = brush
  canvas.isDrawingMode = true

  const paths = []
  const handler = (e) => {
    if (e?.path) paths.push(e.path)
  }
  canvas.on('path:created', handler)

  return { paths, handler }
}

export function updatePencil(ctx) {
  const { canvas, controls } = ctx
  if (!canvas?.freeDrawingBrush) return
  canvas.freeDrawingBrush.width = controls.size
  canvas.freeDrawingBrush.color = controls.color
}

export function commitPencil(ctx) {
  const { canvas, session, controls } = ctx
  if (!session) return

  canvas.off('path:created', session.handler)
  canvas.isDrawingMode = false

  const paths = session.paths
  if (paths.length === 0) return

  // Pull the loose Path objects off the canvas; they're about to become
  // children of a Group. (Leaving them on the canvas while the Group is
  // also added causes double-rendering.)
  for (const p of paths) canvas.remove(p)

  // Fabric v6 computes the Group's bounding box and adjusts child coords
  // so the visual position is preserved.
  const group = new fabric.Group(paths)
  group.deckId = `draw-${Date.now()}-${nextDrawingNumber}`
  group.deckLabel = `drawing #${nextDrawingNumber++}`
  group.deckKind = 'draw'
  group.set({
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false
  })

  canvas.add(group)

  // Stack placement. `controls.insertAt` is one of:
  //   'top' | 'bottom' | `above:<deckId>`
  const slot = controls.insertAt || 'top'
  if (slot === 'top') {
    canvas.bringObjectToFront(group)
  } else if (slot === 'bottom') {
    canvas.sendObjectToBack(group)
  } else if (slot.startsWith('above:')) {
    const targetId = slot.slice('above:'.length)
    const target = canvas.getObjects().find((o) => o.deckId === targetId)
    if (target) {
      const targetIndex = canvas.getObjects().indexOf(target)
      // Final index = the slot directly above target. moveObjectTo will
      // shift other objects to accommodate.
      canvas.moveObjectTo(group, targetIndex + 1)
    }
    // If the target was removed somehow, leave the group where canvas.add
    // put it (top of stack) — sensible fallback.
  }

  canvas.requestRenderAll()
}

export function cleanupPencil(ctx) {
  const { canvas, session } = ctx
  if (!session) return
  canvas.off('path:created', session.handler)
  canvas.isDrawingMode = false
  for (const p of session.paths) canvas.remove(p)
  canvas.requestRenderAll()
}

// React component shown in the deck panel during a Pencil session.
export function PencilTools({ controls, onControlChange }) {
  return (
    <div className="pencil-tools">
      <label className="ctrl">
        <span className="ctrl-label">Size</span>
        <input
          type="range"
          min={1}
          max={60}
          step={1}
          value={controls.size ?? 8}
          onChange={(e) => onControlChange('size', Number(e.target.value))}
        />
        <span className="ctrl-value">{controls.size ?? 8}px</span>
      </label>
      <label className="ctrl">
        <span className="ctrl-label">Color</span>
        <input
          type="color"
          value={controls.color ?? '#000000'}
          onChange={(e) => onControlChange('color', e.target.value)}
        />
        <span className="ctrl-value mono">{controls.color ?? '#000000'}</span>
      </label>
      <p className="hint">Click and drag on the canvas to draw. End commits.</p>
    </div>
  )
}
