// Shuffle Layer Order — reorders the whole committed stack at random.
//
// On draw it rolls a random permutation as a preview. The "Shuffle again"
// button rerolls (within-card adjustment is free until End). cleanup restores
// the order captured at begin.
//
// rollCount is an internal control, not a labeled slider row: every increment
// triggers updateShuffle, which rerolls. We track session.lastRoll so the
// effect's initial fire (rollCount 0) doesn't double-shuffle on top of begin.

export function beginShuffle(ctx) {
  const { canvas } = ctx
  const session = { originalOrder: canvas.getObjects().slice(), lastRoll: 0 }
  shuffleStack(canvas)
  return session
}

export function updateShuffle(ctx) {
  const { canvas, controls, session } = ctx
  if (!session) return
  const roll = controls.rollCount || 0
  if (roll === session.lastRoll) return
  session.lastRoll = roll
  shuffleStack(canvas)
}

export function commitShuffle(ctx) {
  ctx.canvas.requestRenderAll()
}

export function cleanupShuffle(ctx) {
  const { canvas, session } = ctx
  if (!session?.originalOrder) return
  const present = canvas.getObjects()
  session.originalOrder.forEach((o, i) => {
    if (present.includes(o)) canvas.moveObjectTo(o, i)
  })
  canvas.requestRenderAll()
}

// Permute the deck objects' stacking while leaving any non-deck objects in
// their existing slots. moveObjectTo applied in ascending index order imposes
// the exact target order.
function shuffleStack(canvas) {
  const all = canvas.getObjects()
  const deckObjs = all.filter((o) => o.deckId)
  if (deckObjs.length < 2) return
  const shuffled = shuffleDistinct(deckObjs)
  let k = 0
  const target = all.map((o) => (o.deckId ? shuffled[k++] : o))
  target.forEach((o, i) => canvas.moveObjectTo(o, i))
  canvas.requestRenderAll()
}

function shuffleDistinct(arr) {
  // Fisher–Yates, then force a change if the roll happened to be identity.
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  if (out.length >= 2 && out.every((o, i) => o === arr[i])) {
    ;[out[0], out[1]] = [out[1], out[0]]
  }
  return out
}

export function ShuffleTools({ controls, onControlChange }) {
  const roll = controls.rollCount || 0
  return (
    <div className="pencil-tools">
      <button
        type="button"
        className="secondary"
        onClick={() => onControlChange('rollCount', roll + 1)}
      >
        Shuffle again
      </button>
      <p className="hint">
        Layer order was randomized. Shuffle again to reroll, or End to commit
        this order.
      </p>
    </div>
  )
}
