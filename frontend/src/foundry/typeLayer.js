// The type layer (card_maker.md §4) — the slots that float ABOVE the plate
// matte until the Press seals them: name (upper-left), type line
// (upper-right), description (a resizable wireframe Textbox fit to the
// plate's text region). The rarity mark joins in Phase 6.
//
// Everything here is live Fabric text: click to select and nudge within
// the slot's convention, double-click to edit (Fabric's hidden textarea
// makes keymap.js's form-field suppression cover editing for free). Slot
// homes follow the plate-template geometry (foundry_card_template.png,
// 745×1040); plates disagree in the details, which is why every slot
// stays movable.

import * as fabric from 'fabric'
import { ensureFontLoaded } from './fonts.js'

const INK = '#141414'

// The name and type line: single-line editable text, free to nudge/scale.
function slotText(text, fontFamily, options) {
  return new fabric.IText(text, {
    fontFamily,
    fill: INK,
    ...options
  })
}

// Mount all slots above whatever the canvas holds (the plate is already
// there — added later means stacked higher). Fonts are awaited first: an
// unloaded face would render serif and measure wrong.
export async function mountTypeLayer(canvas, commission, fonts) {
  await Promise.all([ensureFontLoaded(fonts.title), ensureFontLoaded(fonts.body)])

  const name = slotText(commission.label, fonts.title.name, {
    left: 50,
    top: 48,
    fontSize: 40
  })
  const typeLine = slotText(commission.family, fonts.title.name, {
    originX: 'right',
    left: 695,
    top: 56,
    fontSize: 24
  })
  const description = new fabric.Textbox('Double-click to set the description.', {
    left: 50,
    top: 660,
    width: 645,
    fontSize: 26,
    lineHeight: 1.25,
    fontFamily: fonts.body.name,
    fill: INK,
    textAlign: 'left'
  })

  canvas.add(name, typeLine, description)
  canvas.requestRenderAll()
  return { name, typeLine, description }
}

// The re-deal (N): swap faces on the living objects — positions, sizes,
// and entered text all survive the roll.
export async function applyTypeFonts(canvas, slots, fonts) {
  await Promise.all([ensureFontLoaded(fonts.title), ensureFontLoaded(fonts.body)])
  slots.name.set('fontFamily', fonts.title.name)
  slots.typeLine.set('fontFamily', fonts.title.name)
  slots.description.set('fontFamily', fonts.body.name)
  for (const obj of Object.values(slots)) {
    obj.initDimensions()
    obj.setCoords()
  }
  canvas.requestRenderAll()
}
