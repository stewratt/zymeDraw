// CARD NAMES + DESCRIPTIONS — now read from the shared copy file.
//
// The text itself lives in src/copy/uiText.json (the single source of
// truth for user-facing copy). Edit it there — either directly or through
// the copy editor at http://localhost:5174/copy-editor — and both apps
// pick it up live. This module stays so every existing importer
// (deck.js, the card files, Foundry) keeps its `CARD_TEXT` import.
//
// Pure data — Vite resolves the JSON import at build time, so deck.js
// (the pure reducer) can still import this safely.
//
// A few cards keep extra stage-specific instructions inline in their
// behavior files (Stamp's cutout notice, Etch's zoom steps, Skim's
// keep/bury beats, the grid-pick prompts) — those are UI mechanics,
// not the card's text.

import uiText from '../copy/uiText.json'

export const CARD_TEXT = uiText.cards
