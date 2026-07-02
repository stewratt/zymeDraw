// The declarative card registry — v2.
//
// Maps each card id to:
//   - controls        : which control keys appear in the panel
//   - defaultControls : initial values for those controls
//   - Tools           : the React component for the per-card UI
//   - begin / update  : lifecycle hooks while the card is live
//   - commit          : the card's own End step (finalize its temp objects)
//   - cleanup         : called if the card is abandoned (restart)
//
// The v2 contract: after a card's commit hook runs, Editor performs the
// UNIVERSAL BAKE (masterRaster.bake) — the whole canvas flattens into the
// master. Cards never implement flattening; their job is only to set up and
// adjust temporary objects/tools during their session.
//
// Adding a new card = one entry here + one behavior file in cards/, built on
// the shared modules (brushCore, effectCardFactory, GridPicker, placement).
// Never add per-card branches to Editor.jsx or DeckPanel.jsx.
//
// Optional shape extension: `Overlay` is a component Editor renders over
// the canvas area while the card is live (Ghost's grid pick; Stamp will
// reuse it). It receives the same props as Tools.
//
// Cards not yet listed (deeper, rails) are placeholders that Editor
// treats as "ready immediately, no tools" — Phases 9–10 fill them in.

import { NoiseTools, noiseHooks } from './noiseBrush.jsx'
import {
  StampOverlay,
  StampTools,
  beginStamp,
  cleanupStamp,
  commitStamp,
  updateStamp
} from './stamp.jsx'
import {
  GhostOverlay,
  GhostTools,
  beginGhost,
  cleanupGhost,
  commitGhost,
  updateGhost
} from './ghost.jsx'
import { BlurTools, blurHooks } from './blurBrush.jsx'
import { HsvBrushTools, hsvBrushHooks } from './hsvBrush.jsx'
import {
  ColorOverlayTools,
  beginColorOverlay,
  cleanupColorOverlay,
  updateColorOverlay
} from './colorOverlay.jsx'
import {
  GlobalHsvTools,
  beginGlobalHsv,
  cleanupGlobalHsv,
  updateGlobalHsv
} from './globalHsv.jsx'
import {
  RepositionTools,
  beginReposition,
  cleanupReposition,
  updateReposition
} from './reposition.jsx'

export const cardRegistry = {
  ghost: {
    controls: ['opacity', 'brightness', 'contrast', 'mode', 'size', 'hardness'],
    defaultControls: {
      opacity: 1,
      brightness: 100,
      contrast: 100,
      mode: 'arrange',
      size: 40,
      hardness: 'soft'
    },
    Tools: GhostTools,
    Overlay: GhostOverlay,
    begin: beginGhost,
    update: updateGhost,
    commit: commitGhost,
    cleanup: cleanupGhost
  },

  stamp: {
    controls: ['opacity', 'mode', 'size', 'hardness'],
    defaultControls: { opacity: 1, mode: 'arrange', size: 40, hardness: 'soft' },
    Tools: StampTools,
    Overlay: StampOverlay,
    begin: beginStamp,
    update: updateStamp,
    commit: commitStamp,
    cleanup: cleanupStamp
  },

  noiseBrush: {
    controls: ['size', 'hardness', 'intensity'],
    defaultControls: { size: 60, hardness: 'soft', intensity: 1 },
    Tools: NoiseTools,
    ...noiseHooks
  },

  blurBrush: {
    controls: ['size', 'hardness', 'intensity', 'radius'],
    defaultControls: { size: 60, hardness: 'soft', intensity: 1, radius: 10 },
    Tools: BlurTools,
    ...blurHooks
  },

  hsvBrush: {
    controls: ['size', 'hardness', 'intensity', 'h', 's', 'v'],
    defaultControls: { size: 60, hardness: 'soft', intensity: 1, h: 0, s: 100, v: 100 },
    Tools: HsvBrushTools,
    ...hsvBrushHooks
  },

  colorOverlay: {
    controls: ['color', 'intensity', 'blend'],
    defaultControls: { color: '#a06a3a', intensity: 0.35, blend: 'multiply' },
    Tools: ColorOverlayTools,
    begin: beginColorOverlay,
    update: updateColorOverlay,
    cleanup: cleanupColorOverlay
  },

  globalHsv: {
    controls: ['h', 's', 'v', 'intensity'],
    defaultControls: { h: 0, s: 100, v: 100, intensity: 1 },
    Tools: GlobalHsvTools,
    begin: beginGlobalHsv,
    update: updateGlobalHsv,
    cleanup: cleanupGlobalHsv
  },

  reposition: {
    controls: ['flipX', 'flipY'],
    defaultControls: { flipX: false, flipY: false },
    Tools: RepositionTools,
    begin: beginReposition,
    update: updateReposition,
    cleanup: cleanupReposition
  }
}
