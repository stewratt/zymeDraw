// The card corner law: every finished face is a rounded rectangle with
// R = 5% of card width (~37px at 745, 112px at the 2235 master). The
// shipped plate PNGs in assets/plates/ already carry this exact alpha (punched by
// tools/round_card_corners.py — keep the two constants in sync); this
// module re-applies it to the FINISHED pixels at export, because the
// graffiti deck may have smeared opaque paint back into the corners.
// The working canvas itself stays square — foundry.css rounds it
// visually, and the truth is cut here at the end.

export const CORNER_RADIUS_FRAC = 0.05

// Cut the corners of a canvas element in place (destination-in keeps
// only what the rounded rect covers, antialiased by the 2d rasterizer).
export function roundCorners(el) {
  const ctx = el.getContext('2d')
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ctx.roundRect(0, 0, el.width, el.height, el.width * CORNER_RADIUS_FRAC)
  ctx.fill()
  ctx.restore()
  return el
}

// A rounded copy, for sources that must not be mutated (the live master).
export function roundedCopy(source) {
  const el = document.createElement('canvas')
  el.width = source.width
  el.height = source.height
  el.getContext('2d').drawImage(source, 0, 0)
  return roundCorners(el)
}
