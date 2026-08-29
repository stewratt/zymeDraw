// The pocket deck — Wave 2's card set (to_do/mobile_plan.md §7).
//
// A deck SPEC, nothing more: [{ id, copies }] is the whole vocabulary the
// reducer takes (deck.js resolveSpec re-derives labels and families itself),
// so this file can never fork the rulebook. The house deck, TUNING, the death
// shuffle and the stash's return all stay exactly as deck.js runs them.
//
// The cut is deliberate and temporary: a graft pair that deals its own grid
// (Ghost, Stain) plus the three washes (Steep, Hue, Cure) — enough variety to
// walk a whole session on a phone with every card verified on-device. Wave 4
// fills the deck in, one card at a time, and sets the real pocket deck with
// Stew (§8 Q3).

export const MOBILE_DECK_SPEC = [
  { id: 'ghost', copies: 2 },
  { id: 'stain', copies: 2 },
  { id: 'steep', copies: 2 },
  { id: 'hue', copies: 2 },
  { id: 'cure', copies: 2 }
]
