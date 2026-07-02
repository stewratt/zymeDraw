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
// The v1 layers-era fields (needsLayersPanel, layersPanelMode, layerKinds,
// targetLayerId) are gone: with flatten-on-End there is only ever one
// committed image.
//
// Adding a new card = one entry here + one behavior file in cards/, built on
// the shared modules (brush core, grid picker, bake engine). Never add
// per-card branches to Editor.jsx or DeckPanel.jsx.
//
// Cards not yet listed here are placeholders that Editor treats as "ready
// immediately, no tools". Phases 5–10 fill in the rest.

import { NoiseTools, beginNoise, cleanupNoise, commitNoise, updateNoise } from './noiseBrush.jsx'

export const cardRegistry = {
  noiseBrush: {
    controls: ['size', 'hardness', 'intensity'],
    defaultControls: { size: 60, hardness: 'soft', intensity: 1 },
    Tools: NoiseTools,
    begin: beginNoise,
    update: updateNoise,
    commit: commitNoise,
    cleanup: cleanupNoise
  }
}
