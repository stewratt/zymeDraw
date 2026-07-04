// Stain — Ghost's dark sibling (Graft × Sink). A fresh grid of 8; take one
// and it joins the piece in `multiply` blend, soaking INTO what's beneath
// instead of floating over it — light areas thin to nothing, dark areas
// stain through. Same freedoms as Ghost: free transform, opacity,
// brightness/contrast, the standing mask brush.

import { makeGraftCard } from './graftCardFactory.jsx'

export const stainCard = makeGraftCard({
  title: 'STAIN',
  subject: 'the stain',
  gridSize: 8,
  blend: 'multiply',
  pickHint: 'Eight images. Take one — it soaks into the piece: only its dark survives.',
  confirmLabel: 'Continue — set the stain',
  arrangeHint: 'Drag, scale, rotate the stain into place. It soaks into what is beneath.'
})
