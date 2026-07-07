// The foundry deck — Foundry's session script (card_maker.md §2). A PURE
// reducer, mirror of editor/deck.js: no Fabric, no DOM, no React. It holds
// card ids, plate descriptors, and the commission — never images or canvas
// objects. All of Foundry's randomness (deck shuffles, the dealt
// commission, the plate offer) lives here, so this one file is the
// complete rulebook.
//
// The arc:
//   COMMISSION    choose (or deal) the card id this face is for
//   PLATE_DEAL    plates are dealt — take one
//   PANEL_PICK    place the image under the plate's alpha window (Phase 3)
//   TYPE_SETTING  set the type above the plate (Phase 4)
//   — the Press — seal the whole foundation to pixels (one commit)
//   WORKING       graffiti rounds, deal/End, destructive
//   COMPLETE      a Proof surfaced — the face is cast; export
//
// Phase-1 hollowness still standing: panel/type are pass-through, and the
// working deck deals placeholder cards (their real behaviors arrive in
// Phase 5 through foundryRegistry).

import { DEATH_CARD, MOD_CARDS } from '../editor/deck.js'

// Every Foundry pacing number lives here.
export const FOUNDRY_TUNING = {
  plateDeal: 3, // plates offered at PLATE_DEAL
  workingRounds: 3, // graffiti rounds before Proofs shuffle in
  proofCount: 2 // Proofs shuffled into whatever deck remains
}

// The working deck: one entry per graffiti card, expanded by copy count and
// shuffled at session start. These are the real Phase-5 roster (brush-core
// cards, card_maker.md §1.8) dealt as placeholders until their registry
// entries land — a scribble stands in for each card's tool.
export const FOUNDRY_CARDS = [
  { id: 'silt', label: 'Silt', copies: 1 },
  { id: 'bruise', label: 'Bruise', copies: 1 },
  { id: 'char', label: 'Char', copies: 1 },
  { id: 'steep', label: 'Steep', copies: 1 }
]

export const PROOF_CARD = { id: 'proof', label: 'Proof' }

// What may be commissioned: every real card design in the Deck, the Coda
// included — it has a face to cast like any other. `copies` rides along for
// rarity (Phase 6): 2 = common, 1 = scarce, the Coda its own class.
export const COMMISSIONS = [
  ...MOD_CARDS.map(({ id, label, copies, family }) => ({
    id,
    label,
    copies,
    family: family ?? 'image'
  })),
  { ...DEATH_CARD, copies: 0, family: 'coda' }
]

// Fisher–Yates on a copy.
function shuffle(cards) {
  const out = [...cards]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildFoundryDeck() {
  const cards = []
  for (const { copies, ...card } of FOUNDRY_CARDS) {
    for (let n = 0; n < copies; n++) cards.push({ ...card, kind: 'mod' })
  }
  return shuffle(cards)
}

function proofCards() {
  return Array.from({ length: FOUNDRY_TUNING.proofCount }, () => ({
    ...PROOF_CARD,
    kind: 'proof'
  }))
}

export function initialFoundryState() {
  return {
    phase: 'COMMISSION',
    commission: null, // { id, label, copies, family } — the card being cast
    plateOffer: [], // the plates on the table at PLATE_DEAL — FoundryEditor
    //                deals them from the plates folder and reports back via
    //                SET_PLATE_OFFER (folder listing is not deck logic; the
    //                SET_GRID pattern)
    plate: null, // the plate taken: { id, file }
    deck: buildFoundryDeck(), // the literal shuffled working deck
    roundsDone: 0,
    proofsShuffled: false,
    currentCard: null,
    history: []
  }
}

// Pure reducer. Illegal actions (wrong phase, unknown ids) return the state
// unchanged rather than throwing — same law as deck.js.
export function foundryReducer(state, action) {
  switch (action.type) {
    case 'CHOOSE_COMMISSION': {
      if (state.phase !== 'COMMISSION') return state
      const commission = COMMISSIONS.find((c) => c.id === action.cardId)
      if (!commission) return state
      return {
        ...state,
        phase: 'PLATE_DEAL',
        commission,
        history: [
          ...state.history,
          { event: 'commission', cardId: commission.id, ts: Date.now() }
        ]
      }
    }

    case 'DEAL_COMMISSION': {
      // "Deal me a commission" — the deck decides which face gets cast.
      if (state.phase !== 'COMMISSION') return state
      const commission =
        COMMISSIONS[Math.floor(Math.random() * COMMISSIONS.length)]
      return {
        ...state,
        phase: 'PLATE_DEAL',
        commission,
        history: [
          ...state.history,
          { event: 'commission', cardId: commission.id, dealt: true, ts: Date.now() }
        ]
      }
    }

    case 'SET_PLATE_OFFER': {
      if (state.phase !== 'PLATE_DEAL') return state
      return { ...state, plateOffer: action.plates }
    }

    case 'TAKE_PLATE': {
      if (state.phase !== 'PLATE_DEAL') return state
      const plate = state.plateOffer.find((p) => p.id === action.plateId)
      if (!plate) return state
      return {
        ...state,
        phase: 'PANEL_PICK',
        plate,
        plateOffer: [],
        history: [
          ...state.history,
          { event: 'plate', plateId: plate.id, ts: Date.now() }
        ]
      }
    }

    // Advancing PANEL_PICK → TYPE_SETTING is NOT a commit: the whole
    // foundation stays live (re-pick, re-word, nudge) until the Press.
    case 'END_PANEL': {
      if (state.phase !== 'PANEL_PICK') return state
      return { ...state, phase: 'TYPE_SETTING' }
    }

    case 'PRESS': {
      // The one seal at the phase boundary (card_maker.md §3.5). The actual
      // bake is FoundryEditor's job — the reducer only records the crossing.
      if (state.phase !== 'TYPE_SETTING') return state
      return {
        ...state,
        phase: 'WORKING',
        history: [...state.history, { event: 'press', ts: Date.now() }]
      }
    }

    case 'DEAL': {
      if (state.phase !== 'WORKING' || state.currentCard) return state
      if (state.deck.length === 0) return state
      const [card, ...deck] = state.deck
      if (card.kind === 'proof') {
        // Like the Coda: instant end, no End press, no final round.
        return {
          ...state,
          phase: 'COMPLETE',
          deck,
          currentCard: card,
          history: [
            ...state.history,
            { event: 'proof', ts: Date.now() }
          ]
        }
      }
      return { ...state, deck, currentCard: card }
    }

    case 'COMMIT': {
      if (state.phase !== 'WORKING' || !state.currentCard) return state
      const roundsDone = state.roundsDone + 1
      const next = {
        ...state,
        roundsDone,
        currentCard: null,
        history: [
          ...state.history,
          { event: 'card', cardId: state.currentCard.id, ts: Date.now() }
        ]
      }
      // Enough rounds worked (or the deck ran dry): the Proofs join
      // whatever remains. From here the cast ends whenever one surfaces.
      if (
        !state.proofsShuffled &&
        (roundsDone >= FOUNDRY_TUNING.workingRounds || next.deck.length === 0)
      ) {
        return {
          ...next,
          deck: shuffle([...next.deck, ...proofCards()]),
          proofsShuffled: true
        }
      }
      return next
    }

    case 'RESTART':
      return initialFoundryState()

    default:
      return state
  }
}

// Short human label for where the working phase stands. Derived, never stored.
export function foundryProgressLabel(state) {
  if (state.phase !== 'WORKING') return null
  if (state.proofsShuffled) return 'late — the Proofs are in the deck'
  return `round ${state.roundsDone + 1} of ${FOUNDRY_TUNING.workingRounds}`
}
