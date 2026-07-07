// The Foundry card registry — the same declarative contract as
// editor/cards/registry.jsx, from day one:
//
//   - controls / defaultControls : panel control keys + initial values
//   - Tools                      : the per-card React UI
//   - begin / update / commit / cleanup : lifecycle hooks
//   - optional: Overlay, randomize, skipBake, hotkeys (see the Deck
//     registry's header for each one's meaning)
//
// The contract: after a card's commit, FoundryEditor performs the UNIVERSAL
// BAKE — cards never implement flattening. FoundryEditor provides the same
// ctx shape as Deck's Editor (canvas, master, controls, canvasWidth/Height,
// report, setControl, isCancelled), which is why Phase 5 can point entries
// straight at the shared behavior files in editor/cards/ WITHOUT
// modification. If a card file ever seems to need a Foundry fork, first ask
// whether this ctx shape is being honored (card_maker.md §3).
//
// Never add per-card branches to FoundryEditor.jsx or FoundryPanel.jsx.
//
// Phase 1: intentionally empty. The working deck's cards deal as
// placeholders (FoundryEditor arms a plain scribble brush for any card
// without an entry); the brush-core entries land here in Phase 5.

export const foundryRegistry = {}
