// The deck — v3 session script. A PURE reducer: no Fabric, no DOM, no React.
// It holds card ids and filenames, never images or canvas objects. All the
// session's randomness (deck shuffles) also lives here, so this one file is
// the complete rulebook.
//
// The arc:
//   OPENING_PICK   a fixed grid of images; take two — one placed, one stashed
//   PLACEMENT      arrange the placed image; End bakes
//   WORKING        deal cards from the literal shuffled deck, one round each
//   STASH_RETURN   after Act I, the stash comes back as one placement session
//   WORKING        Act II; then death cards are shuffled into whatever deck
//                  remains — dealing one ends the session instantly
//   COMPLETE       the piece is finished; export
//
// "Death card" is the design term; on screen the card is called Coda.

// Every pacing number lives here.
export const TUNING = {
  openingGrid: 24, // images dealt into the opening grid (6×4)
  actOneRounds: 4, // card rounds before the stash returns
  actTwoRounds: 2, // rounds after that before death cards are shuffled in
  deathCount: 3 // death cards shuffled into the remaining deck
}

// The mod deck: one entry per card design, expanded by copy count and
// shuffled at session start. Rebalancing the deck = editing this array.
export const MOD_CARDS = [
  { id: 'ghost', label: 'Ghost', copies: 2 },
  { id: 'stamp', label: 'Stamp', copies: 2 },
  { id: 'deeper', label: 'Deeper', copies: 2 },
  { id: 'noiseBrush', label: 'Noise Brush', copies: 1 },
  { id: 'blurBrush', label: 'Blur Brush', copies: 1 },
  { id: 'hsvBrush', label: 'HSV Brush', copies: 1 },
  { id: 'colorOverlay', label: 'Color Overlay', copies: 1 },
  { id: 'globalHsv', label: 'HSV', copies: 1 },
  { id: 'reposition', label: 'Reposition', copies: 1 },
  { id: 'rails', label: 'Rails', copies: 1 }
  // Stashed until Stew trains his own style model — the demo ONNX styles
  // don't look good enough to ship. Card files, registry entries, and the
  // /style sidecar endpoint all stay in place; re-add these lines to deal
  // them again. See CLAUDE.md §0 (style-transfer experiment).
  // { id: 'transfer', label: 'Transfer', copies: 2 },
  // { id: 'shatteredTransfer', label: 'Shattered Transfer', copies: 2 }
]

export const DEATH_CARD = { id: 'coda', label: 'Coda' }

// Fisher–Yates on a copy.
function shuffle(cards) {
  const out = [...cards]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildDeck() {
  const cards = []
  for (const { id, label, copies } of MOD_CARDS) {
    for (let n = 0; n < copies; n++) cards.push({ id, label, kind: 'mod' })
  }
  return shuffle(cards)
}

function deathCards() {
  return Array.from({ length: TUNING.deathCount }, () => ({
    ...DEATH_CARD,
    kind: 'death'
  }))
}

export function initialState() {
  return {
    phase: 'OPENING_PICK',
    grid: [], // filenames offered in the opening pick (Editor samples them
    //           and reports back via SET_GRID — fetching is not deck logic)
    toPlace: [], // filenames being arranged in the current placement session
    stash: [], // filenames held back for the stash return
    deck: buildDeck(), // the literal shuffled deck, dealt from the front
    roundsDealt: 0,
    stashReturned: false,
    deathShuffled: false,
    currentCard: null,
    history: []
  }
}

// Pure reducer. Every transition is atomic — read one case to see exactly
// which fields change. Illegal actions (wrong phase, over-picking) return
// the state unchanged rather than throwing.
export function deckReducer(state, action) {
  switch (action.type) {
    case 'SET_GRID': {
      if (state.phase !== 'OPENING_PICK') return state
      return { ...state, grid: action.filenames }
    }

    case 'CONFIRM_PICK': {
      if (state.phase !== 'OPENING_PICK') return state
      const placed = action.placed ?? []
      const stashed = action.stashed ?? []
      // Take two, strictly: one placed now, one stashed for later. The stash
      // return is a constant beat — exactly one image, every session.
      const legal =
        placed.length === 1 &&
        stashed.length === 1 &&
        [...placed, ...stashed].every((f) => state.grid.includes(f))
      if (!legal) return state
      return {
        ...state,
        phase: 'PLACEMENT',
        toPlace: placed,
        stash: stashed,
        history: [
          ...state.history,
          { event: 'pick', placed, stashed, ts: Date.now() }
        ]
      }
    }

    case 'END_PLACEMENT': {
      if (state.phase === 'PLACEMENT') {
        return {
          ...state,
          phase: 'WORKING',
          toPlace: [],
          history: [...state.history, { event: 'placement', ts: Date.now() }]
        }
      }
      if (state.phase === 'STASH_RETURN') {
        return {
          ...state,
          phase: 'WORKING',
          toPlace: [],
          stash: [],
          stashReturned: true,
          history: [...state.history, { event: 'stash-return', ts: Date.now() }]
        }
      }
      return state
    }

    case 'DEAL': {
      if (state.phase !== 'WORKING' || state.currentCard) return state
      if (state.deck.length === 0) return state
      const [card, ...deck] = state.deck
      if (card.kind === 'death') {
        // Instant end: no End press, no final modification.
        return {
          ...state,
          phase: 'COMPLETE',
          deck,
          currentCard: card,
          history: [
            ...state.history,
            { event: 'death', cardId: card.id, ts: Date.now() }
          ]
        }
      }
      return { ...state, deck, currentCard: card }
    }

    case 'COMMIT': {
      if (state.phase !== 'WORKING' || !state.currentCard) return state
      const roundsDealt = state.roundsDealt + 1
      const next = {
        ...state,
        roundsDealt,
        currentCard: null,
        history: [
          ...state.history,
          { event: 'card', cardId: state.currentCard.id, ts: Date.now() }
        ]
      }

      // End of Act I: the stash comes back as one placement session.
      if (
        roundsDealt === TUNING.actOneRounds &&
        !state.stashReturned &&
        state.stash.length > 0
      ) {
        return { ...next, phase: 'STASH_RETURN', toPlace: state.stash }
      }

      // End of Act II (or an empty deck, if the knobs ever outrun it):
      // shuffle the death cards into whatever remains. From here the session
      // ends whenever one surfaces — odds rise naturally as the deck thins.
      const actsDone =
        roundsDealt >= TUNING.actOneRounds + TUNING.actTwoRounds
      if (!state.deathShuffled && (actsDone || next.deck.length === 0)) {
        return {
          ...next,
          deck: shuffle([...next.deck, ...deathCards()]),
          deathShuffled: true
        }
      }
      return next
    }

    case 'RESTART':
      return initialState()

    default:
      return state
  }
}

// Short human label for where the session stands. Derived, never stored.
export function progressLabel(state) {
  if (state.phase !== 'WORKING') return null
  if (state.deathShuffled) return 'late — the Coda is in the deck'
  const { actOneRounds, actTwoRounds } = TUNING
  if (state.roundsDealt < actOneRounds) {
    return `Act I · round ${state.roundsDealt + 1} of ${actOneRounds}`
  }
  return `Act II · round ${state.roundsDealt - actOneRounds + 1} of ${actTwoRounds}`
}
