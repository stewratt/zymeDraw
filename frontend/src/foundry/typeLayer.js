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
import { CARD_TEXT } from '../editor/cardText.js'
import { ensureFontLoaded } from './fonts.js'
import { makeRarityMark } from './rarity.js'
import { DEFAULT_HOMES, loadSlotHomes } from './slotHomes.js'

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
export async function mountTypeLayer(canvas, commission, fonts, plateFile) {
  await Promise.all([ensureFontLoaded(fonts.title), ensureFontLoaded(fonts.body)])

  // Where each slot spawns: the plate's learned home (slotHomes.js) if it
  // has ever been sealed, else the neutral default. originX/fonts below
  // stay creation-time identity — only spawn geometry is remembered.
  const learned = loadSlotHomes(plateFile)
  const home = (slot) => ({ ...DEFAULT_HOMES[slot], ...learned?.[slot] })

  const name = slotText(commission.label, fonts.title.name, home('name'))
  const typeLine = slotText(commission.family, fonts.title.name, {
    originX: 'right',
    ...home('typeLine')
  })
  // The description mirrors what Deck's card panel says (cardText.js is
  // the single source for both apps); still fully editable on the face.
  const descriptionText =
    CARD_TEXT[commission.id]?.description ?? 'Double-click to set the description.'
  const description = new fabric.Textbox(descriptionText, {
    ...home('description'),
    lineHeight: 1.25,
    fontFamily: fonts.body.name,
    fill: INK,
    textAlign: 'left'
  })

  // The rarity mark (rarity.js): the fourth slot, stamped at casting time.
  const rarity = makeRarityMark(commission)

  canvas.add(name, typeLine, description, rarity)
  canvas.requestRenderAll()
  return { name, typeLine, description, rarity }
}

// Ink a slot (Stew, 2026-07-07: dark plates need light type, and slots are
// colored independently). The common ring carries its color in stroke, not
// fill — everything else is a fill.
export function inkSlot(obj, color) {
  if (obj.stroke && !obj.fill) obj.set('stroke', color)
  else obj.set('fill', color)
}

// The re-deal (N): swap faces on the living objects — positions, sizes,
// and entered text all survive the roll. The rarity mark carries no type.
export async function applyTypeFonts(canvas, slots, fonts) {
  await Promise.all([ensureFontLoaded(fonts.title), ensureFontLoaded(fonts.body)])
  slots.name.set('fontFamily', fonts.title.name)
  slots.typeLine.set('fontFamily', fonts.title.name)
  slots.description.set('fontFamily', fonts.body.name)
  for (const obj of [slots.name, slots.typeLine, slots.description]) {
    obj.initDimensions()
    obj.setCoords()
  }
  canvas.requestRenderAll()
}
