// The declarative card registry. Maps each card id to:
//   - controls            : which control keys appear in the panel
//   - defaultControls     : initial values for those controls
//   - needsLayersPanel    : whether to show the Layers panel
//   - layersPanelMode     : 'slot' (Pencil) | 'target' (Eraser/HSV/Blur)
//   - layerKinds          : optional whitelist of layer kinds the panel may
//                           show (e.g. ['image'] for Eraser). Omit for all.
//   - Tools               : the React component for the per-card UI
//   - begin / update      : lifecycle hooks during the act phase
//   - commit              : the destructive End step
//   - cleanup             : called if the card is abandoned (restart)
//
// Adding a new card later = one entry here + one behavior file in cards/.
// Editor.jsx and DeckPanel.jsx don't need to know about each card's specifics.

import {
  AddCardTools,
  commitAddCardImages,
  placeAddCardImages,
  updateAddCard
} from './addCard.jsx'

import {
  PencilTools,
  beginPencil,
  commitPencil,
  cleanupPencil,
  updatePencil
} from './pencil.jsx'

import {
  EraserTools,
  beginEraser,
  commitEraser,
  cleanupEraser,
  updateEraser
} from './eraser.jsx'

import {
  FlattenTools,
  beginFlatten,
  commitFlatten,
  cleanupFlatten
} from './flatten.jsx'

import {
  HsvTools,
  beginHsv,
  commitHsv,
  cleanupHsv,
  updateHsv
} from './hsv.jsx'

import {
  BlurTools,
  beginBlur,
  commitBlur,
  cleanupBlur,
  updateBlur
} from './blur.jsx'

import {
  GrainTools,
  beginGrain,
  commitGrain,
  cleanupGrain,
  updateGrain
} from './grain.jsx'

import {
  GradeTools,
  beginGrade,
  commitGrade,
  cleanupGrade,
  updateGrade
} from './grade.jsx'

import {
  FlipTools,
  beginFlip,
  commitFlip,
  cleanupFlip
} from './flip.jsx'

import {
  RemoveLayerTools,
  beginRemove,
  commitRemove,
  cleanupRemove,
  updateRemove
} from './removeLayer.jsx'

import {
  ShuffleTools,
  beginShuffle,
  commitShuffle,
  cleanupShuffle,
  updateShuffle
} from './shuffle.jsx'

import {
  ZoomFlattenTools,
  beginZoomFlatten,
  commitZoomFlatten,
  cleanupZoomFlatten
} from './zoomFlatten.jsx'

import {
  FrameTools,
  beginFrame,
  commitFrame,
  cleanupFrame,
  updateFrame
} from './frame.jsx'

import {
  FinalGradeTools,
  beginFinalGrade,
  commitFinalGrade,
  cleanupFinalGrade,
  updateFinalGrade
} from './finalGrade.jsx'

import {
  GrainFinishTools,
  beginGrainFinish,
  commitGrainFinish,
  cleanupGrainFinish,
  updateGrainFinish
} from './grainFinish.jsx'

function makeAddEntry(count) {
  return {
    controls: [],
    defaultControls: { layerOrder: null },
    needsLayersPanel: true,
    layersPanelMode: 'reorder',
    Tools: AddCardTools,
    begin: async (ctx) => {
      const result = await placeAddCardImages(
        ctx.canvas,
        count,
        ctx.imageList,
        ctx.canvasWidth,
        ctx.canvasHeight
      )
      if (result.ok) {
        ctx.report({ placedFilenames: result.placed.map((p) => p.filename) })
      }
      return { placed: result.placed }
    },
    update: updateAddCard,
    commit: (ctx) => {
      commitAddCardImages(ctx.canvas, ctx.session?.placed || [])
    }
  }
}

export const cardRegistry = {
  add1: makeAddEntry(1),
  add2: makeAddEntry(2),
  add3: makeAddEntry(3),

  // Retained as the base for the upcoming brush cards. Removed from the draw
  // pool in deck.js, so this entry is currently unreachable by design.
  pencil: {
    controls: ['size', 'color'],
    defaultControls: { size: 8, color: '#000000', insertAt: 'top' },
    needsLayersPanel: true,
    layersPanelMode: 'slot',
    Tools: PencilTools,
    begin: beginPencil,
    update: updatePencil,
    commit: commitPencil,
    cleanup: cleanupPencil
  },

  eraser: {
    controls: ['size'],
    defaultControls: { size: 30, targetLayerId: null },
    needsLayersPanel: true,
    layersPanelMode: 'target',
    layerKinds: ['image'],
    Tools: EraserTools,
    begin: beginEraser,
    update: updateEraser,
    commit: commitEraser,
    cleanup: cleanupEraser
  },

  flatten: {
    controls: [],
    defaultControls: {},
    needsLayersPanel: false,
    Tools: FlattenTools,
    begin: beginFlatten,
    commit: commitFlatten,
    cleanup: cleanupFlatten
  },

  hsv: {
    controls: ['h', 's', 'v'],
    defaultControls: { h: 0, s: 0, v: 0, targetLayerId: null },
    needsLayersPanel: true,
    layersPanelMode: 'target',
    layerKinds: ['image'],
    Tools: HsvTools,
    begin: beginHsv,
    update: updateHsv,
    commit: commitHsv,
    cleanup: cleanupHsv
  },

  blur: {
    controls: ['intensity'],
    defaultControls: { intensity: 0, targetLayerId: null },
    needsLayersPanel: true,
    layersPanelMode: 'target',
    layerKinds: ['image'],
    Tools: BlurTools,
    begin: beginBlur,
    update: updateBlur,
    commit: commitBlur,
    cleanup: cleanupBlur
  },

  grain: {
    controls: ['amount'],
    defaultControls: { amount: 0.3 },
    needsLayersPanel: false,
    Tools: GrainTools,
    begin: beginGrain,
    update: updateGrain,
    commit: commitGrain,
    cleanup: cleanupGrain
  },

  grade: {
    controls: ['preset'],
    defaultControls: { preset: null },
    needsLayersPanel: false,
    Tools: GradeTools,
    begin: beginGrade,
    update: updateGrade,
    commit: commitGrade,
    cleanup: cleanupGrade
  },

  flip: {
    controls: [],
    defaultControls: {},
    needsLayersPanel: false,
    Tools: FlipTools,
    begin: beginFlip,
    commit: commitFlip,
    cleanup: cleanupFlip
  },

  removeLayer: {
    controls: [],
    defaultControls: { targetLayerId: null },
    needsLayersPanel: true,
    layersPanelMode: 'target',
    // No layerKinds: any layer (image, draw, grain…) can be removed.
    Tools: RemoveLayerTools,
    begin: beginRemove,
    update: updateRemove,
    commit: commitRemove,
    cleanup: cleanupRemove
  },

  shuffle: {
    controls: [],
    defaultControls: { rollCount: 0 },
    needsLayersPanel: true,
    layersPanelMode: 'display',
    Tools: ShuffleTools,
    begin: beginShuffle,
    update: updateShuffle,
    commit: commitShuffle,
    cleanup: cleanupShuffle
  },

  zoomFlatten: {
    controls: [],
    defaultControls: {},
    needsLayersPanel: false,
    Tools: ZoomFlattenTools,
    begin: beginZoomFlatten,
    commit: commitZoomFlatten,
    cleanup: cleanupZoomFlatten
  },

  frame: {
    controls: ['thickness', 'color'],
    defaultControls: { thickness: 30, color: '#ffffff' },
    needsLayersPanel: false,
    Tools: FrameTools,
    begin: beginFrame,
    update: updateFrame,
    commit: commitFrame,
    cleanup: cleanupFrame
  },

  finalGrade: {
    controls: ['preset'],
    defaultControls: { preset: 'cinema' },
    needsLayersPanel: false,
    Tools: FinalGradeTools,
    begin: beginFinalGrade,
    update: updateFinalGrade,
    commit: commitFinalGrade,
    cleanup: cleanupFinalGrade
  },

  grainFinish: {
    controls: ['amount'],
    defaultControls: { amount: 0.4 },
    needsLayersPanel: false,
    Tools: GrainFinishTools,
    begin: beginGrainFinish,
    update: updateGrainFinish,
    commit: commitGrainFinish,
    cleanup: cleanupGrainFinish
  }

  // All cards complete. Phase 6 (polish) is optional.
}
