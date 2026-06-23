// Remove 1 Layer — destructive midgame card.
//
// Uses the shared 'target' layer-picker (no layerKinds filter, so every layer
// kind is selectable). Picking a layer hides it as a live preview; End deletes
// it for good. cleanup (restart) restores visibility — though restart wipes the
// canvas anyway, this keeps the hook honest.

export function beginRemove() {
  return { hiddenId: null }
}

export function updateRemove(ctx) {
  const { canvas, controls, session } = ctx
  if (!session) return
  const targetId = controls.targetLayerId || null

  // Restore the previously-previewed layer if the selection moved off it.
  if (session.hiddenId && session.hiddenId !== targetId) {
    setVisible(canvas, session.hiddenId, true)
    session.hiddenId = null
  }
  // Hide the newly-selected layer as the "this is what disappears" preview.
  if (targetId && session.hiddenId !== targetId) {
    setVisible(canvas, targetId, false)
    session.hiddenId = targetId
  }
  canvas.requestRenderAll()
}

export function commitRemove(ctx) {
  const { canvas, controls } = ctx
  const targetId = controls.targetLayerId
  if (!targetId) return
  const obj = canvas.getObjects().find((o) => o.deckId === targetId)
  if (obj) canvas.remove(obj)
  canvas.requestRenderAll()
}

export function cleanupRemove(ctx) {
  const { canvas, session } = ctx
  if (session?.hiddenId) setVisible(canvas, session.hiddenId, true)
  canvas.requestRenderAll()
}

function setVisible(canvas, deckId, value) {
  const obj = canvas.getObjects().find((o) => o.deckId === deckId)
  if (obj) obj.set('visible', value)
}

export function RemoveLayerTools({ controls }) {
  const hasTarget = !!controls.targetLayerId
  return (
    <div className="pencil-tools">
      <p className="hint">
        {hasTarget
          ? 'That layer is hidden as a preview. End permanently deletes it.'
          : 'Pick any layer on the right to remove. Deletion is permanent on End.'}
      </p>
    </div>
  )
}
