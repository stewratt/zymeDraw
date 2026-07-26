// The Foundry card registry — the same declarative contract as
// editor/cards/registry.jsx, from day one:
//
//   - controls / defaultControls : panel control keys + initial values
//   - Tools                      : the per-card React UI
//   - begin / update / commit / cleanup : lifecycle hooks
//   - optional: randomize, skipBake, hotkeys (see the Deck registry's
//     header for each one's meaning)
//
// The contract: after a card's commit, FoundryEditor performs the UNIVERSAL
// BAKE — cards never implement flattening. FoundryEditor provides the same
// ctx shape as Deck's Editor (canvas, master, controls, imageList,
// canvasWidth/Height, report, setControl, isCancelled), which is why the
// wave-1 entries below point straight at Deck's OWN registry entries —
// the shared behavior files run WITHOUT modification. If a card ever seems
// to need a Foundry fork, first ask whether the ctx shape is being honored
// (card_maker.md §3).
//
// Never add per-card branches to FoundryEditor.jsx or FoundryPanel.jsx.
//
// Not yet carried over: `deckActions` (no deck-facing cards in Foundry) and
// the rest of the graft family (Ghost, Stain) + Deeper — a later wave.
// Nor `commitGate` (issue #92): no card in the roster below declares one, and
// FoundryPanel/FoundryEditor would need the same generic treatment Deck's got
// — the resting state, the entry button, the skip — before one is added.

import { cardRegistry } from '../editor/cards/registry.jsx'

// Graffiti wave 1 (card_maker.md §1.8) plus Stamp (Stew, 2026-07-07: the
// cutout is an important degradation — it deals at double weight in
// FOUNDRY_CARDS). Stamp brings the first `Overlay` (its grid pick) and
// degrades gracefully when the ML sidecar is down: the whole image places
// and the erase brush takes over.
const ROSTER = ['stamp', 'dust', 'bruise', 'blur', 'steep', 'hue', 'cure', 'char', 'rails']

export const foundryRegistry = Object.fromEntries(
  ROSTER.map((id) => [id, cardRegistry[id]])
)
