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
// Cards not yet listed (ghost, stamp, deeper, rails) are placeholders that
// Editor treats as "ready immediately, no tools" — Phases 6–10 fill them in.

import { NoiseTools, noiseHooks } from './noiseBrush.jsx'
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
