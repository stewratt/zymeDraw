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
// Not yet carried over: `Overlay` cards (the graft family's grid picks) and
// `deckActions` — they arrive with the graft wave (card_maker.md Phase 7).

import { cardRegistry } from '../editor/cards/registry.jsx'

// Graffiti wave 1 (card_maker.md §1.8): everything that needs only the
// raster + the brush engine.
const WAVE_1 = ['silt', 'bruise', 'dissolve', 'steep', 'turn', 'cure', 'char', 'rails']

export const foundryRegistry = Object.fromEntries(
  WAVE_1.map((id) => [id, cardRegistry[id]])
)
