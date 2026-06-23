// The deck — Phase 2 version.
//
// Cards are still placeholders: each one knows its id, label, and kind
// (add / midgame / endgame). Phase 4 will expand each entry into a full
// "card registry" item describing the controls it shows, the commit
// behavior, etc. For now, drawing a card and committing one does nothing
// to the canvas — it just advances the state machine.

export const ADD_CARDS = [
  { id: 'add1', label: 'Add 1', kind: 'add', count: 1 },
  { id: 'add2', label: 'Add 2', kind: 'add', count: 2 },
  { id: 'add3', label: 'Add 3', kind: 'add', count: 3 }
]

export const MIDGAME_CARDS = [
  // 'pencil' was removed from the draw pool. Its behavior file (pencil.jsx)
  // and registry entry are intentionally kept as the base for the upcoming
  // brush cards — it just can no longer be drawn.
  { id: 'eraser',  label: 'Eraser',       kind: 'midgame' },
  { id: 'flatten', label: 'Flatten',      kind: 'midgame' },
  { id: 'hsv',     label: 'Layer HSV',    kind: 'midgame' },
  { id: 'blur',    label: 'Layer Blur',   kind: 'midgame' },
  { id: 'grain',   label: 'Canvas Grain', kind: 'midgame' },
  { id: 'grade',   label: 'Color Grade',  kind: 'midgame' },
  { id: 'flip',    label: 'Flip Canvas',  kind: 'midgame' },
  { id: 'removeLayer', label: 'Remove Layer', kind: 'midgame' },
  { id: 'shuffle', label: 'Shuffle Layers', kind: 'midgame' },
  { id: 'zoomFlatten', label: 'Zoom & Flatten', kind: 'midgame' }
]

export const ENDGAME_CARDS = [
  { id: 'frame',       label: 'Frame',        kind: 'endgame' },
  { id: 'finalGrade',  label: 'Final Grade',  kind: 'endgame' },
  { id: 'grainFinish', label: 'Grain Finish', kind: 'endgame' }
]

// Picked once per session. Random integer in {3, 4, 5}.
function pickEndgameThreshold() {
  return 3 + Math.floor(Math.random() * 3)
}

export function initialState() {
  return {
    phase: 'BEGINNING',
    midgameRounds: 0,
    endgameThreshold: pickEndgameThreshold(),
    currentCard: null,
    history: []
  }
}

// The eligible-pool function is the heart of the rule "which cards can come
// up next." Beginning = only adds. Midgame = adds + midgame, until the
// threshold flips, then adds + midgame + endgame too. Endgame_drawn has no
// further draws (the session is over).
export function eligiblePool(state) {
  if (state.phase === 'BEGINNING') return ADD_CARDS
  if (state.phase === 'MIDGAME') {
    const endgameUnlocked = state.midgameRounds >= state.endgameThreshold
    return endgameUnlocked
      ? [...ADD_CARDS, ...MIDGAME_CARDS, ...ENDGAME_CARDS]
      : [...ADD_CARDS, ...MIDGAME_CARDS]
  }
  return []
}

export function endgameUnlocked(state) {
  return state.phase === 'MIDGAME' && state.midgameRounds >= state.endgameThreshold
}

// Pure reducer. Every transition is atomic — read one case to see exactly
// which fields change. Draw with replacement: a sample from `eligiblePool`.
export function deckReducer(state, action) {
  switch (action.type) {
    case 'DRAW': {
      if (state.currentCard) return state
      const pool = eligiblePool(state)
      if (pool.length === 0) return state
      const card = pool[Math.floor(Math.random() * pool.length)]
      return { ...state, currentCard: card }
    }

    case 'COMMIT': {
      if (!state.currentCard) return state
      const card = state.currentCard
      const history = [...state.history, { cardId: card.id, kind: card.kind, ts: Date.now() }]

      if (state.phase === 'BEGINNING') {
        // Beginning phase is always exactly one committed round.
        return { ...state, phase: 'MIDGAME', currentCard: null, history }
      }

      if (state.phase === 'MIDGAME') {
        if (card.kind === 'endgame') {
          // Drawing and committing an endgame card ends the session.
          // Phase 5 will hook export off this transition.
          return { ...state, phase: 'ENDGAME_DRAWN', currentCard: null, history }
        }
        return { ...state, midgameRounds: state.midgameRounds + 1, currentCard: null, history }
      }

      return state
    }

    case 'RESTART':
      return initialState()

    default:
      return state
  }
}
