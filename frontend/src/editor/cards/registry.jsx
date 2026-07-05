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
//     is live (the grid picks). Same props as Tools.
//   - commit may be async (Deeper awaits the sidecar's detail restore);
//     Editor awaits it and shows a generic "committing" state.
//   - begin may await the user (Ghost's pick, Etch's frame) — End stays
//     disabled until it resolves; begin's ctx has isCancelled for restarts.

import { ghostCard } from './ghost.jsx'
import { stainCard } from './stain.jsx'
import { graftControls } from './graftCardFactory.jsx'
import { RailsTools, beginRails, cleanupRails, commitRails, updateRails } from './rails.jsx'
import { CharTools, beginChar, cleanupChar, commitChar, updateChar } from './char.jsx'
import { DeeperTools, beginDeeper, cleanupDeeper, commitDeeper } from './deeper.jsx'
import { RackTools, beginRack, cleanupRack, updateRack } from './rack.jsx'
import { EtchTools, beginEtch, cleanupEtch, commitEtch, updateEtch } from './etch.jsx'
import {
  StampOverlay,
  StampTools,
  beginStamp,
  cleanupStamp,
  commitStamp,
  updateStamp
} from './stamp.jsx'
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
    controls: ['opacity', 'mode', 'size', 'hardness', 'strength'],
    defaultControls: { opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', strength: 1 },
    Tools: StampTools,
    Overlay: StampOverlay,
    begin: beginStamp,
    update: updateStamp,
    commit: commitStamp,
    cleanup: cleanupStamp
  },

  // ---- Stencil (image read as an alpha cutout of itself) ----

  rails: {
    controls: ['color', 'opacity', 'mode', 'size', 'hardness', 'strength'],
    defaultControls: { color: '#c43c28', opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', strength: 1 },
    Tools: RailsTools,
    begin: beginRails,
    update: updateRails,
    commit: commitRails,
    cleanup: cleanupRails
  },

  char: {
    controls: ['depth', 'opacity', 'mode', 'size', 'hardness', 'strength'],
    defaultControls: { depth: 0.7, opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', strength: 1 },
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
    begin: beginRack,
    update: updateRack,
    cleanup: cleanupRack
  },

  // ---- Reveal brushes (paint the effect where it belongs) ----

  silt: {
    // Playtest tuning (2026-07-04): Stew works these two brushes big and
    // faint — open there instead of small and full-strength.
    controls: ['size', 'hardness', 'intensity'],
    defaultControls: { size: 180, hardness: 'soft', intensity: 0.15 },
    Tools: SiltTools,
    ...siltHooks
  },

  dissolve: {
    controls: ['size', 'hardness', 'intensity', 'radius'],
    defaultControls: { size: 180, hardness: 'soft', intensity: 0.7, radius: 10 },
    Tools: DissolveTools,
    ...dissolveHooks
  },

  bruise: {
    controls: ['size', 'hardness', 'intensity', 'h', 's', 'v'],
    defaultControls: { size: 60, hardness: 'soft', intensity: 1, h: 0, s: 100, v: 100 },
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

  // ---- Etch (pixel glyph at the master's grain) ----

  etch: {
    controls: ['color', 'pixel'],
    defaultControls: { color: '#c43c28', pixel: 1 },
    Tools: EtchTools,
    begin: beginEtch,
    update: updateEtch,
    commit: commitEtch,
    cleanup: cleanupEtch
  },

  // ---- Stashed (await Stew's trained style models — see deck.js) ----

  transfer: {
    controls: ['opacity', 'mode', 'size', 'hardness', 'strength'],
    // No arrange here — the brush is always in hand, opening on conceal.
    defaultControls: { opacity: 1, mode: 'conceal', size: 60, hardness: 'soft', strength: 1 },
    Tools: TransferTools,
    begin: beginTransfer,
    update: updateTransfer,
    commit: commitTransfer,
    cleanup: cleanupTransfer
  },

  shatteredTransfer: {
    controls: ['opacity', 'mode', 'size', 'hardness', 'strength'],
    defaultControls: { opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', strength: 1 },
    Tools: ShatteredTransferTools,
    Overlay: ShatteredTransferOverlay,
    begin: beginShatteredTransfer,
    update: updateShatteredTransfer,
    commit: commitShatteredTransfer,
    cleanup: cleanupShatteredTransfer
  }
}
