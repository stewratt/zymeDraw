// Ghost — a second exposure (Graft × Rise). A fresh grid of 8; take one
// and it joins the piece in `screen` blend, so only its light survives —
// dark areas vanish, bright areas glow through. Free transform, opacity,
// brightness/contrast, and the standing mask brush. End bakes it in.

import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { makeGraftCard } from './graftCardFactory.jsx'

export const ghostCard = makeGraftCard({
  title: UI.cardHints.ghost.pickTitle,
  subject: UI.cardHints.ghost.subject,
  gridSize: 8,
  blend: 'screen',
  pickHint: UI.cardHints.ghost.pickHint,
  confirmLabel: UI.cardHints.ghost.confirm,
  arrangeHint: CARD_TEXT.ghost.description
})
