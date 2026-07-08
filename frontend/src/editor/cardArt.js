// Card face art — one image per card design, keyed by card id.
//
// TWO sources, in order:
//   1. An external SET — a per-machine folder of alternate deck designs,
//      chosen in Setup and served by the backend at
//      /api/cards/<set>/<id>.png. One subfolder per set; drop a whole new
//      design in and switch to it. See backend /api/cards.
//   2. The BUNDLED art at frontend/src/assets/cards/<id>.png (745×1040) —
//      the built-in default set, globbed at build time so a clone with no
//      external folder still runs. (Local-only placeholders today; the
//      repo's global *.png gitignore keeps them out — un-ignore with
//      `!frontend/src/assets/cards/*.png` when the real faces are committed.)
//
// Faces are keyed by the card's ID (`ghost.png`), never its display name —
// renaming a card in the copy editor never touches which file it loads.
// A missing face at every source falls back to <Card>'s text face.

import { useSyncExternalStore } from 'react'

const bundled = import.meta.glob('../assets/cards/*.png', {
  eager: true,
  import: 'default'
})

function bundledArt(id) {
  return bundled[`../assets/cards/${id}.png`] ?? null
}

// ---- the active-set store (shared by every <Card>, wherever it renders) ----
// A tiny external store instead of a React context: Card is rendered from
// many trees (deck panel, overlays, zoom, plinth), and this reaches them all
// without threading a provider through each one.
const STORAGE_KEY = 'deck.cardSet'
const listeners = new Set()
let state = { sets: [], activeSet: null, folder: null }

function emit() {
  for (const l of listeners) l()
}

function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useCardSets() {
  return useSyncExternalStore(subscribe, () => state)
}

export function useActiveCardSet() {
  return useSyncExternalStore(subscribe, () => state.activeSet)
}

// Fetch the sets the backend can see. Restores the last chosen set from
// localStorage if it still exists; otherwise stays on the built-in art.
export async function loadCardSets() {
  let sets = []
  let folder = null
  try {
    const res = await fetch('/api/cards')
    const data = await res.json()
    if (data.ok) {
      sets = data.sets
      folder = data.folder
    }
  } catch {
    // No backend / no folder = built-in art only. Never blocks the app.
  }
  const remembered = localStorage.getItem(STORAGE_KEY)
  const activeSet = sets.some((s) => s.name === remembered) ? remembered : null
  state = { sets, activeSet, folder }
  emit()
  return state
}

// Choose a set (or null for the built-in art). Persisted per browser.
export function setActiveCardSet(name) {
  const activeSet = state.sets.some((s) => s.name === name) ? name : null
  if (activeSet) localStorage.setItem(STORAGE_KEY, activeSet)
  else localStorage.removeItem(STORAGE_KEY)
  state = { ...state, activeSet }
  emit()
}

// The ordered face URLs to try for a card: the active set first, the bundled
// art next, then nothing (→ text face). <Card> walks these on image error, so
// a set that omits a face transparently borrows the built-in one.
//
// `variant` (1 = the base face) is a card copy's design. A card dealt in N
// copies may carry N distinct faces: copy 1 = `<id>.png`, copy 2 =
// `<id>.2.png`, … Extra variants are OPT-IN — within each source tier we try
// the variant face first and fall back to the bare `<id>.png`, so a set that
// only ships one design has both copies borrow it with no special-casing (the
// same error-walk that lets a set omit a card entirely). Generalizes to 3x+.
export function cardArtSources(id, activeSet, variant = 1) {
  const names = variant > 1 ? [`${id}.${variant}`, id] : [id]
  const sources = []
  // Active set first — variant face, then the bare face.
  if (activeSet) {
    for (const name of names) {
      sources.push(`/api/cards/${encodeURIComponent(activeSet)}/${name}.png`)
    }
  }
  // Bundled next, same variant-then-bare order.
  for (const name of names) {
    const b = bundledArt(name)
    if (b) sources.push(b)
  }
  return sources
}
