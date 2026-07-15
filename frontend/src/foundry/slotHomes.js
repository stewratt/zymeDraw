// Per-plate memory for where the type slots want to sit (issue #43).
//
// Plates are user files identified only by filename (plates.js), so there
// is no code registry to hang a home on — instead each plate LEARNS its
// home from the last sealed layout, keyed by filename in localStorage. The
// DEFAULT_HOMES below seed the first-ever cast of any plate: a neutral home
// tuned to the shared template geometry (foundry_card_template.png,
// 745×1040), so even an untrained plate lands close.

const STORE_KEY = 'deck.foundry.slotHomes'

// The neutral seed homes — the tuning constants for the type slots, in one
// place (§5). originX and the fonts stay creation-time identity in
// typeLayer.js; only spawn geometry lives here.
export const DEFAULT_HOMES = {
  name: { left: 50, top: 48, fontSize: 40 },
  typeLine: { left: 695, top: 56, fontSize: 24 },
  description: { left: 50, top: 660, fontSize: 26, width: 645 }
}

// The transform props we remember per slot: position plus any scale/rotate
// nudge, and the description box's resized width. NOT fontSize — Fabric
// scaling writes scaleX/scaleY, so the transform already carries a resize.
const REMEMBERED = ['left', 'top', 'scaleX', 'scaleY', 'angle', 'width']

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {}
  } catch {
    return {}
  }
}

// The learned home for one plate, or null if it has never been sealed.
export function loadSlotHomes(plateFile) {
  if (!plateFile) return null
  return readStore()[plateFile] || null
}

// Remember the current geometry of the three slots under this plate's
// filename. Called at the Press: the sealed layout is the signal "this was
// good enough," so the next card on this plate spawns where the last one
// finished. A nicety — it must never throw into the seal.
export function saveSlotHomes(plateFile, slots) {
  if (!plateFile || !slots) return
  const store = readStore()
  const homes = {}
  for (const key of ['name', 'typeLine', 'description']) {
    const obj = slots[key]
    if (!obj) continue
    const geo = {}
    for (const prop of REMEMBERED) {
      if (obj[prop] !== undefined) geo[prop] = obj[prop]
    }
    homes[key] = geo
  }
  store[plateFile] = homes
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // Storage full or blocked — the plate just stays untrained. Never block.
  }
}
