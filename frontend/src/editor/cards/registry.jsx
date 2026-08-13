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
//     actions: Searcher's pick, Skim's choices), and `workUrl` (the latest
//     committed state as an image — overlays cover the canvas, so a card
//     whose decision is about the piece shows the piece).
//     `Tools` gets `deckView` and `onDeckAction` too, on the same fence — a
//     deck-facing card whose round resolves in the panel (Skim) needs no
//     overlay at all.
//   - `dockCard`: (deckView) => card|null — the card this round turns FACE-UP
//     ON TOP OF THE DECK. Declaring it is how a card says its reveal resolves
//     at the dock instead of over the canvas (Skim, issue #120): DeckPanel
//     hands the result to DeckDock, which turns the deck's top card over in
//     place, a touch larger than dock scale, with its name above the face.
//     The canvas stays visible for the whole round.
//   - `randomize`: (defaults) => defaults, applied when the card is dealt
//     — for cards that open on a random setting (Bruise's hue), beyond
//     the automatic `color` re-roll.
//   - commit may be async (Deeper awaits the sidecar's detail restore);
//     Editor awaits it and shows a generic "committing" state.
//   - begin may await the user (Ghost's pick, Etch's frame) — End stays
//     disabled until it resolves; begin's ctx has isCancelled for restarts.
//   - `skipBake`: the card never touches the canvas (Searcher), so End skips
//     the universal bake and the state capture — nothing changed.
//   - `deckActions`: the reducer action types this card's Overlay may fire
//     through `onDeckAction`. Editor builds its fence from this list — a
//     card can never dispatch a deck action it hasn't declared, and the
//     reducer's legality guards remain the real gate.
//   - `commitGate`: { label } — the card commits on its OWN button instead of
//     on the deck click (the re-frame pair, issue #92). The session begins at
//     the deal like any other card's; pressing the labelled button — rendered
//     by DeckPanel at the foot of the description panel, above the deck dock —
//     runs the whole commit (hook, universal bake, state capture) mid-round,
//     so the result is on screen before the next card is dealt. The deck click
//     then only deals. Drawing BEFORE that press is a pass: the card's cleanup
//     hook takes its objects off the canvas, nothing bakes, nothing is
//     captured. Tools get a `committed` prop (always false for an ungated
//     card) so a card's own copy can speak to its two states.
//   - `hotkeys`: keyboard accents [{ key|code, shift?, run(ctx, e) }]
//     (hotkeys.md §5.4). Editor dispatches them ahead of the shared scopes
//     (keymap.js); run gets { controls, setControl, info, session, canvas }
//     and may return false to pass the key along. Any card with a `color`
//     control gets N (re-roll the hue) for free, like the random opening.
//   Every lifecycle hook's ctx carries `canvasWidth`/`canvasHeight` — the
//   ARTBOARD, the 800×1000 document a card sees. The Fabric buffer is the
//   whole pasteboard (window-sized, with the artboard floating in it), so a
//   hook that needs the document's size must take it from the ctx and never
//   from canvas.getWidth(). Commit was missing these, which is how the frame
//   pair's re-frame drifted with window size (issue #80).
//   A card that works at an unusual scale (Etch, at the master's grain) does
//   NOT own the viewport — it rides the shared camera through `ctx.nav`
//   (canvasNav): focusRect() dives to a region and setZoomBounds() soft-locks
//   the wheel band for the session. The phase-change re-fit restores the
//   defaults, so neither the transform nor the lock leaks past End.

import { MOD_CARDS } from '../deck.js'
import { ghostCard } from './ghost.jsx'
import { stainCard } from './stain.jsx'
import { graftControls } from './graftCardFactory.jsx'
import { RailsTools, beginRails, cleanupRails, commitRails, updateRails } from './rails.jsx'
import { CharTools, beginChar, cleanupChar, commitChar, updateChar } from './char.jsx'
import { DeeperTools, beginDeeper, cleanupDeeper, commitDeeper } from './deeper.jsx'
import { CloserTools, beginCloser, cleanupCloser, commitCloser } from './closer.jsx'
import { frameCommitGate } from './frameCardFactory.jsx'
import { LiftTools, beginLift, cleanupLift, commitLift, liftHotkeys } from './lift.jsx'
import { FractureTools, beginFracture, cleanupFracture, commitFracture, updateFracture } from './fracture.jsx'
import { GwarpTools, beginGwarp, cleanupGwarp, updateGwarp } from './gwarp.jsx'
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
import {
  ReverberateOverlay,
  ReverberateTools,
  beginReverberate,
  cleanupReverberate,
  commitReverberate,
  updateReverberate
} from './reverberate.jsx'
import { SearcherOverlay, SearcherTools, beginSearcher } from './searcher.jsx'
import { SkimTools, beginSkim, skimDockCard } from './skim.jsx'
import { DelayTools } from './delay.jsx'
import { DustTools, dustHooks } from './dust.jsx'
import { BlurTools, blurHooks } from './blur.jsx'
import { BruiseTools, bruiseHooks } from './bruise.jsx'
import { SmieerTools, beginSmieer, cleanupSmieer, commitSmieer, updateSmieer } from './smieer.jsx'
import { SteepTools, beginSteep, cleanupSteep, updateSteep } from './steep.jsx'
import { HueTools, beginHue, cleanupHue, updateHue } from './hue.jsx'
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

  // ---- Stamp brush (Stamp's cutout front × the stamp session) ----

  reverberate: {
    controls: ['size', 'spacing', 'opacity', 'jitter'],
    defaultControls: { size: 120, spacing: 0.6, opacity: 1, jitter: 0.3 },
    Tools: ReverberateTools,
    Overlay: ReverberateOverlay,
    begin: beginReverberate,
    update: updateReverberate,
    commit: commitReverberate,
    cleanup: cleanupReverberate
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
    controls: ['darken', 'saturation', 'opacity', 'mode', 'size', 'hardness', 'softness', 'strength'],
    defaultControls: { darken: 0.5, saturation: 0.5, opacity: 1, mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 },
    Tools: CharTools,
    begin: beginChar,
    update: updateChar,
    commit: commitChar,
    cleanup: cleanupChar
  },

  // ---- Re-frame (the master itself is the object) ----
  // Both end on the gate button (issue #92): the frame is offered, not
  // imposed — draw instead of pressing it and the card passes, uncommitted.

  deeper: {
    controls: [],
    defaultControls: {},
    Tools: DeeperTools,
    commitGate: frameCommitGate,
    begin: beginDeeper,
    commit: commitDeeper,
    cleanup: cleanupDeeper
  },

  closer: {
    controls: [],
    defaultControls: {},
    Tools: CloserTools,
    commitGate: frameCommitGate,
    begin: beginCloser,
    commit: commitCloser,
    cleanup: cleanupCloser
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

  // ---- Lift (relocation only — the piece's pixels change address) ----

  lift: {
    controls: [],
    defaultControls: {},
    Tools: LiftTools,
    hotkeys: liftHotkeys,
    begin: beginLift,
    commit: commitLift,
    cleanup: cleanupLift
  },

  // ---- Fracture (all-over voronoi displacement + the standing mask brush) ----

  fracture: {
    controls: ['seed', 'scale', 'opacity', 'mode', 'size', 'hardness', 'softness', 'strength'],
    // The erase brush opens in hand (conceal), like Transfer — no arrange.
    defaultControls: { seed: 0, scale: 600, opacity: 1, mode: 'conceal', size: 60, hardness: 'soft', softness: 0.5, strength: 1 },
    // Open on a random distribution so no two deals fracture the same way.
    randomize: (d) => ({ ...d, seed: Math.floor(Math.random() * 100) }),
    Tools: FractureTools,
    begin: beginFracture,
    update: updateFracture,
    commit: commitFracture,
    cleanup: cleanupFracture
  },

  // ---- Gwarp (the sheet bends on a control lattice) ----
  // No commit hook: the overlay is already the warped piece, so End just bakes
  // it. Phase 2 adds the lattice handles and the drag; Phase 3 the reset,
  // per-gesture undo and the hide-lattice key.

  gwarp: {
    controls: ['grid'],
    defaultControls: { grid: 3 },
    Tools: GwarpTools,
    begin: beginGwarp,
    update: updateGwarp,
    cleanup: cleanupGwarp
  },

  // ---- Reveal brushes (paint the effect where it belongs) ----

  dust: {
    // Playtest tuning (2026-07-04): Stew works these two brushes big and
    // faint — open there instead of small and full-strength.
    // (2026-07-26): influence opens back at 15% — 30% settles too much grain
    // on the first stroke to build up from.
    controls: ['size', 'hardness', 'softness', 'intensity'],
    defaultControls: { size: 180, hardness: 'soft', softness: 0.5, intensity: 0.15 },
    Tools: DustTools,
    ...dustHooks
  },

  blur: {
    controls: ['size', 'hardness', 'softness', 'intensity', 'radius'],
    defaultControls: { size: 180, hardness: 'soft', softness: 0.5, intensity: 0.7, radius: 10 },
    Tools: BlurTools,
    ...blurHooks
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

  // ---- Smieer brush (the piece dragged into itself) ----

  smieer: {
    // No `mode`, so no E/R/S keys — the brush has one op. `size`, `hardness`
    // and `strength` carry their usual contracts, so brackets, Shift+drag and
    // H arrive unasked.
    controls: ['size', 'hardness', 'softness', 'strength'],
    defaultControls: { size: 120, hardness: 'soft', softness: 0.5, strength: 0.6 },
    Tools: SmieerTools,
    begin: beginSmieer,
    update: updateSmieer,
    commit: commitSmieer,
    cleanup: cleanupSmieer
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

  hue: {
    controls: ['h', 's', 'v', 'intensity'],
    defaultControls: { h: 0, s: 100, v: 100, intensity: 1 },
    Tools: HueTools,
    begin: beginHue,
    update: updateHue,
    cleanup: cleanupHue
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

  searcher: {
    controls: [],
    defaultControls: {},
    Tools: SearcherTools,
    Overlay: SearcherOverlay,
    begin: beginSearcher,
    deckActions: ['PICK_FROM_DECK'],
    skipBake: true
  },

  // No Overlay: the reveal happens on the deck itself (dockCard) and the
  // choice in the panel, so the canvas is never covered (issue #120).
  skim: {
    controls: [],
    defaultControls: {},
    Tools: SkimTools,
    dockCard: skimDockCard,
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

  // ---- The stash's return (issue #88) ----
  // Declared here because every card deck.js can deal belongs in the
  // registry, but it holds no hooks: the deal itself opens the stash beat
  // (deck.js → STASH_RETURN_NOTICE), the way a dealt Coda opens the Coda, so
  // the card is never a WORKING round with a canvas of its own. Its panel
  // and its face live in cards/stashReturn.jsx; the placement it triggers is
  // the shared stash-return session Editor already runs.
  stashReturn: {
    controls: [],
    defaultControls: {},
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
