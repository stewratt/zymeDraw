// Ghost — a second exposure (Graft × Rise). A fresh grid of 8; take one
// and it joins the piece in `screen` blend, so only its light survives —
// dark areas vanish, bright areas glow through. Free transform, opacity,
// brightness/contrast, and the standing mask brush. End bakes it in.

import { makeGraftCard } from './graftCardFactory.jsx'

export const ghostCard = makeGraftCard({
  title: 'GHOST',
  subject: 'the ghost',
  gridSize: 8,
  blend: 'screen',
  pickHint: 'Eight images. Take one — it joins the piece as a second exposure: only its light survives.',
  confirmLabel: 'Continue — place the ghost',
  arrangeHint: 'Drag, scale, rotate the ghost into place. Only its light survives the blend.'
})
