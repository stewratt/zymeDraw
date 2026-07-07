// Stain — Ghost's dark sibling (Graft × Sink). A fresh grid of 8; take one
// and it joins the piece in `multiply` blend, soaking INTO what's beneath
// instead of floating over it — light areas thin to nothing, dark areas
// stain through. Same freedoms as Ghost: free transform, opacity,
// brightness/contrast, the standing mask brush.

import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { makeGraftCard } from './graftCardFactory.jsx'

export const stainCard = makeGraftCard({
  title: UI.cardHints.stain.pickTitle,
  subject: UI.cardHints.stain.subject,
  gridSize: 8,
  blend: 'multiply',
  pickHint: UI.cardHints.stain.pickHint,
  confirmLabel: UI.cardHints.stain.confirm,
  arrangeHint: CARD_TEXT.stain.description
})
