// Walk the Fabric canvas and return the "deck layers" — anything we've
// tagged with deckId during a card's commit step. Returns bottom-first
// (matches canvas.getObjects() order). Callers reverse() for top-down display.
export function getCommittedLayers(canvas) {
  if (!canvas) return []
  return canvas
    .getObjects()
    .filter((obj) => obj.deckId)
    .map((obj) => ({
      id: obj.deckId,
      label: obj.deckLabel || obj.deckId,
      kind: obj.deckKind || 'unknown',
      object: obj
    }))
}
