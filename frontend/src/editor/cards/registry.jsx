// The declarative card registry — v3.
//
// Maps each card id to:
//   - controls        : which control keys appear in the panel
//   - defaultControls : initial values for those controls
//   - Tools           : the React component for the per-card UI
//   - begin / update  : lifecycle hooks while the card is live
//   - commit          : the card's own End step (finalize its temp objects)
//   - cleanup         : called if the card is abandoned (restart)
//
// The contract: after a card's commit hook runs, Editor performs the
// UNIVERSAL BAKE (masterRaster.bake) — the whole canvas flattens into the
// master. Cards never implement flattening; their job is only to set up and
// adjust temporary objects/tools during their session.
//
// Adding a new card = one entry here + one behavior file in cards/, built on
// the shared modules (brushCore, effectCardFactory, graftCardFactory,
// GridPicker, placement). Never add per-card branches to Editor.jsx or
// DeckPanel.jsx.
//
// Optional shape extensions Editor applies generically:
//   - `Overlay`: a component rendered over the canvas area while the card
//     is live (the grid picks). Same props as Tools, plus `deckView`
//     (deck.js selector outputs only — the legibility policy holds),
//     `onDeckAction` (a fenced dispatch for the deck-facing cards'
//     actions: Cull's pick, Skim's choices), and `workUrl` (the latest
//     committed state as an image — overlays cover the canvas, so a card
//     whose decision is about the piece shows the piece).
//   - `randomize`: (defaults) => defaults, applied when the card is dealt
//     — for cards that open on a random setting (Bruise's hue), beyond
//     the automatic `color` re-roll.
//   - commit may be async (Deeper awaits the sidecar's detail restore);
//     Editor awaits it and shows a generic "committing" state.
//   - begin may await the user (Ghost's pick, Etch's frame) — End stays
//     disabled until it resolves; begin's ctx has isCancelled for restarts.
//   - `skipBake`: the card never touches the canvas (Cull), so End skips
//     the universal bake and the state capture — nothing changed.
//   - `deckActions`: the reducer action types this card's Overlay may fire
//     through `onDeckAction`. Editor builds its fence from this list — a
//     card can never dispatch a deck action it hasn't declared, and the
//     reducer's legality guards remain the real gate.
//   - `hotkeys`: keyboard accents [{ key|code, shift?, run(ctx, e) }]
//     (hotkeys.md §5.4). Editor dispatches them ahead of the shared scopes
//     (keymap.js); run gets { controls, setControl, info, session, canvas }
//     and may return false to pass the key along. Any card with a `color`
//     control gets N (re-roll the hue) for free, like the random opening.

import { MOD_CARDS } from '../deck.js'
import { ghostCard } from './ghost.jsx'
import { stainCard } from './stain.jsx'
import { graftControls } from './graftCardFactory.jsx'
import { RailsTools, beginRails, cleanupRails, commitRails, updateRails } from './rails.jsx'
import { CharTools, beginChar, cleanupChar, commitChar, updateChar } from './char.jsx'
import { DeeperTools, beginDeeper, cleanupDeeper, commitDeeper } from './deeper.jsx'
import { RackTools, beginRack, cleanupRack, rackHotkeys, updateRack } from './rack.jsx'
import { EtchTools, beginEtch, cleanupEtch, commitEtch, etchHotkeys, updateEtch } from './etch.jsx'
import {
  StampOverlay,
  StampTools,
  beginStamp,
  cleanupStamp,
  commitStamp,
  updateStamp
} from './stamp.jsx'
import { CullOverlay, CullTools, beginCull } from './cull.jsx'
import { SkimOverlay, SkimTools, beginSkim } from './skim.jsx'
import { DelayTools } from './delay.jsx'
import { SiltTools, siltHooks } from './silt.jsx'
import { DissolveTools, dissolveHooks } from './dissolve.jsx'
import { BruiseTools, bruiseHooks } from './bruise.jsx'
import { SteepTools, beginSteep, cleanupSteep, updateSteep } from './steep.jsx'
import { TurnTools, beginTurn, cleanupTurn, updateTurn } from './turn.jsx'
import { CureTools, beginCure, cleanupCure, updateCure } from './cure.jsx'
import {
  TransferTools,
  beginTransfer,
  cleanupTransfer,
  commitTransfer,
  updateTransfer
} from './transfer.jsx'
import {
  ShatteredTransferOverlay,
  ShatteredTransferTools,
  beginShatteredTransfer,
  cleanupShatteredTransfer,
  commitShatteredTransfer,
  updateShatteredTransfer
} from './shatteredTransfer.jsx'

export const cardRegistry = {
  // ---- Graft (grid pick → placed image + mask brush) ----

  ghost: { ...graftControls, ...ghostCard },
  stain: { ...graftControls, ...stainCard },

  stamp: {
    controls: ['opacity', 'mode', 'size', 'hardness', 'softness', 'strength'],
    defaultControls: { opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 },
    Tools: StampTools,
    Overlay: StampOverlay,
    begin: beginStamp,
    update: updateStamp,
    commit: commitStamp,
    cleanup: cleanupStamp
  },

  // ---- Stencil (image read as an alpha cutout of itself) ----

  rails: {
    controls: ['color', 'opacity', 'mode', 'size', 'hardness', 'softness', 'strength'],
    defaultControls: { color: '#c43c28', opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 },
    Tools: RailsTools,
    begin: beginRails,
    update: updateRails,
    commit: commitRails,
    cleanup: cleanupRails
  },

  char: {
    controls: ['depth', 'opacity', 'mode', 'size', 'hardness', 'softness', 'strength'],
    defaultControls: { depth: 0.7, opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 },
    Tools: CharTools,
    begin: beginChar,
    update: updateChar,
    commit: commitChar,
    cleanup: cleanupChar
  },

  // ---- Re-frame (the master itself is the object) ----

  deeper: {
    controls: [],
    defaultControls: {},
    Tools: DeeperTools,
    begin: beginDeeper,
    commit: commitDeeper,
    cleanup: cleanupDeeper
  },

  rack: {
    controls: ['flipX', 'flipY'],
    defaultControls: { flipX: false, flipY: false },
    Tools: RackTools,
    hotkeys: rackHotkeys,
    begin: beginRack,
    update: updateRack,
    cleanup: cleanupRack
  },

  // ---- Reveal brushes (paint the effect where it belongs) ----

  silt: {
    // Playtest tuning (2026-07-04): Stew works these two brushes big and
    // faint — open there instead of small and full-strength.
    // (2026-07-06): influence opens at 30% — 15% was too faint a start.
    controls: ['size', 'hardness', 'softness', 'intensity'],
    defaultControls: { size: 180, hardness: 'soft', softness: 0.5, intensity: 0.3 },
    Tools: SiltTools,
    ...siltHooks
  },

  dissolve: {
    controls: ['size', 'hardness', 'softness', 'intensity', 'radius'],
    defaultControls: { size: 180, hardness: 'soft', softness: 0.5, intensity: 0.7, radius: 10 },
    Tools: DissolveTools,
    ...dissolveHooks
  },

  bruise: {
    controls: ['size', 'hardness', 'softness', 'intensity', 'h', 's', 'v'],
    defaultControls: { size: 60, hardness: 'soft', softness: 0.5, intensity: 1, h: 0, s: 100, v: 100 },
    // Playtest tuning (2026-07-06): open on a small random hue shift
    // (±20°) so the bruise never starts on the same tint twice.
    randomize: (d) => ({ ...d, h: Math.round(Math.random() * 40) - 20 }),
    Tools: BruiseTools,
    ...bruiseHooks
  },

  // ---- Washes (whole-canvas, influence mandatory) ----

  steep: {
    controls: ['color', 'intensity', 'blend'],
    defaultControls: { color: '#a06a3a', intensity: 0.35, blend: 'multiply' },
    Tools: SteepTools,
    begin: beginSteep,
    update: updateSteep,
    cleanup: cleanupSteep
  },

  turn: {
    controls: ['h', 's', 'v', 'intensity'],
    defaultControls: { h: 0, s: 100, v: 100, intensity: 1 },
    Tools: TurnTools,
    begin: beginTurn,
    update: updateTurn,
    cleanup: cleanupTurn
  },

  cure: {
    controls: ['intensity'],
    defaultControls: { intensity: 0.5 },
    Tools: CureTools,
    begin: beginCure,
    update: updateCure,
    cleanup: cleanupCure
  },

  // ---- The deck itself (v4 Wave 2: order-control, dealt by chance) ----

  cull: {
    controls: [],
    defaultControls: {},
    Tools: CullTools,
    Overlay: CullOverlay,
    begin: beginCull,
    deckActions: ['PICK_FROM_DECK'],
    skipBake: true
  },

  skim: {
    controls: [],
    defaultControls: {},
    Tools: SkimTools,
    Overlay: SkimOverlay,
    begin: beginSkim,
    deckActions: ['SKIM', 'SKIM_KEEP', 'SKIM_BURY'],
    skipBake: true
  },

  // No begin, no overlay: the round is a beat — the right it grants lives
  // in deck.js (delayHeld) and pays off at the Coda (CODA_CHOICE).
  delay: {
    controls: [],
    defaultControls: {},
    Tools: DelayTools,
    skipBake: true
  },

  // ---- Etch (pixel glyph at the master's grain) ----

  etch: {
    controls: ['color', 'pixel'],
    defaultControls: { color: '#c43c28', pixel: 1 },
    Tools: EtchTools,
    hotkeys: etchHotkeys,
    begin: beginEtch,
    update: updateEtch,
    commit: commitEtch,
    cleanup: cleanupEtch
  },

  // ---- Stashed (await Stew's trained style models — see deck.js) ----

  transfer: {
    controls: ['opacity', 'mode', 'size', 'hardness', 'softness', 'strength'],
    // No arrange here — the brush is always in hand, opening on conceal.
    defaultControls: { opacity: 1, mode: 'conceal', size: 60, hardness: 'soft', softness: 0.5, strength: 1 },
    Tools: TransferTools,
    begin: beginTransfer,
    update: updateTransfer,
    commit: commitTransfer,
    cleanup: cleanupTransfer
  },

  shatteredTransfer: {
    controls: ['opacity', 'mode', 'size', 'hardness', 'softness', 'strength'],
    defaultControls: { opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 },
    Tools: ShatteredTransferTools,
    Overlay: ShatteredTransferOverlay,
    begin: beginShatteredTransfer,
    update: updateShatteredTransfer,
    commit: commitShatteredTransfer,
    cleanup: cleanupShatteredTransfer
  }
}

// Every card deck.js can deal must resolve here. Editor tolerates a missing
// entry as a placeholder round (deliberate — cards are built in waves), but
// that tolerance would also swallow a typo'd id, so surface the gap in dev.
if (import.meta.env.DEV) {
  for (const { id } of MOD_CARDS) {
    if (!cardRegistry[id]) {
      console.warn(`MOD_CARDS deals "${id}" but cardRegistry has no entry for it.`)
    }
  }
}
