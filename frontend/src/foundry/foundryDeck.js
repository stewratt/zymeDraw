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
//   WORKING       graffiti rounds, destructive — one click on the deck
//                 commits the round in hand and deals the next (issue #98)
//   COMPLETE      a Proof surfaced — the face is cast; export
//
// Phase-1 hollowness still standing: panel/type are pass-through, and the
// working deck deals placeholder cards (their real behaviors arrive in
// Phase 5 through foundryRegistry).

import { CARD_TEXT } from '../editor/cardText.js'
import { UI, fmt } from '../copy/uiText.js'
import { DEATH_CARD, MOD_CARDS, STASH_RETURN_CARD } from '../editor/deck.js'

// Every Foundry pacing number lives here. (The plate offer has no number:
// every plate in the folder is on the table — chosen, never dealt. Stew,
// 2026-07-07: the base is where control comes back.)
export const FOUNDRY_TUNING = {
  panelGrid: 12, // images dealt into the panel pick (re-dealable with N)
  workingRounds: 3, // graffiti rounds before Proofs shuffle in
  proofCount: 2 // Proofs shuffled into whatever deck remains
}

// The working deck: one entry per graffiti card, expanded by copy count and
// shuffled fresh for every impression. Stamp leads at three, Char and Rails
// at two (Stew, 2026-07-07: the stamps and stencils are the important
// degradations, Stamp most of all); the rest deal at one. Ghost/Stain/
// Deeper still wait on a later wave. Labels come from cardText.js, same as
// the main deck.
export const FOUNDRY_CARDS = [
  { id: 'stamp', copies: 3 }, // Graft (cutout)
  { id: 'char', copies: 2 }, // Stencil × Sink
  { id: 'rails', copies: 2 }, // Stencil × solid
  { id: 'dust', copies: 1 }, // Reveal × deposit
  { id: 'bruise', copies: 1 }, // Reveal × Bruise
  { id: 'blur', copies: 1 }, // Reveal × blur
  { id: 'steep', copies: 1 }, // Wash × Sink
  { id: 'hue', copies: 1 }, // Wash (hue)
  { id: 'cure', copies: 1 } // Wash × Cure
].map((card) => ({ label: CARD_TEXT[card.id]?.name ?? card.id, ...card }))

export const PROOF_CARD = { id: 'proof', label: UI.foundry.proof.cardLabel }

// What may be commissioned: every real card design in the Deck, the Coda
// included — it has a face to cast like any other. `rarity` rides along
// from the card descriptor (issue #42): a hardcoded weirdness tier, not
// derived from copies. The Coda's and the Stash Return's 'singular' tier is
// set by family in rarity.js, so neither needs a rarity here.
//
// Family is a Foundry concern — it prints as the type line — so the two
// non-mod cards get theirs here rather than on their deck.js descriptors,
// where Deck's own image/deck split (cardFamily) would read them wrong.
export const COMMISSIONS = [
  ...MOD_CARDS.map(({ id, label, copies, family, rarity }) => ({
    id,
    label,
    copies,
    family: family ?? 'image',
    rarity
  })),
  { ...DEATH_CARD, copies: 0, family: 'coda' },
  // The stash's return is castable like any other face (Stew, 2026-07-26):
  // it never joins a built deck, but the session deals it, so it needs a
  // design — and a custom one may be cast for it like the rest.
  { ...STASH_RETURN_CARD, copies: 0, family: 'stash' }
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
    plateOffer: [], // the plates on the table at PLATE_DEAL — the WHOLE
    //                folder, face up (chosen, not dealt); FoundryEditor
    //                lists the folder and reports back via SET_PLATE_OFFER
    //                (folder listing is not deck logic; the SET_GRID pattern)
    plate: null, // the plate taken: { id, file }
    panelGrid: [], // the panel pick's dealt images — tagged filenames
    //               (`in:`/`out:`, panelArt.js), reported via SET_PANEL_GRID
    panelArt: null, // the tagged filename placed under the window, or null
    typeFonts: null, // the dealt style pairing { style, title, body } —
    //                 font descriptors (ids + urls), dealt by FoundryEditor
    //                 from fonts.js and reported via SET_TYPE_FONTS
    deck: buildFoundryDeck(), // the literal shuffled working deck
    // The print run: N impressions of the SAME sealed base, deviating only
    // after the Press. Its size is commissioned at the plate (issue #36 —
    // an explicit SET_RUN_SIZE choice, not inherited from deck copies) and
    // fixes when the plate is taken; copyIndex advances via NEXT_IMPRESSION.
    copiesTotal: 1,
    copyIndex: 1,
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
        copiesTotal: 1,
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
        copiesTotal: 1,
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

    // The run is commissioned here, while the plates are on the table —
    // taking the plate fixes it. Any whole number ≥ 1.
    case 'SET_RUN_SIZE': {
      if (state.phase !== 'PLATE_DEAL') return state
      const size = Math.floor(action.size)
      if (!Number.isFinite(size) || size < 1) return state
      return { ...state, copiesTotal: size }
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

    case 'SET_PANEL_GRID': {
      if (state.phase !== 'PANEL_PICK') return state
      return { ...state, panelGrid: action.files }
    }

    case 'PICK_PANEL': {
      if (state.phase !== 'PANEL_PICK') return state
      if (!state.panelGrid.includes(action.file)) return state
      return {
        ...state,
        panelArt: action.file,
        history: [
          ...state.history,
          { event: 'panel', file: action.file, ts: Date.now() }
        ]
      }
    }

    // Foundation liveness (§3.5): before the Press, the art can go back on
    // the table. The dealt grid stays the same — the re-pick is a change of
    // mind within the deal, not a fresh deal.
    case 'REPICK_PANEL': {
      if (state.phase !== 'PANEL_PICK' || !state.panelArt) return state
      return { ...state, panelArt: null }
    }

    // Advancing PANEL_PICK → TYPE_SETTING is NOT a commit: the whole
    // foundation stays live (re-pick, re-word, nudge) until the Press. The UI
    // only reaches here once an image is placed (the take is the progression);
    // the reducer stays permissive rather than re-asserting that invariant.
    case 'END_PANEL': {
      if (state.phase !== 'PANEL_PICK') return state
      return { ...state, phase: 'TYPE_SETTING' }
    }

    // The font deal — first deal and every N re-roll land here. Recording
    // the style in history at Press time isn't needed: the face itself is
    // the record.
    case 'SET_TYPE_FONTS': {
      if (state.phase !== 'TYPE_SETTING') return state
      if (!action.fonts) return state
      return { ...state, typeFonts: action.fonts }
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

    // The run continues: the next impression re-enters WORKING from the
    // sealed base with a FRESH working deck — the impressions share every
    // core component and deviate only in their degradation. Restoring the
    // base master is FoundryEditor's impure job on this same action.
    case 'NEXT_IMPRESSION': {
      if (state.phase !== 'COMPLETE') return state
      if (state.copyIndex >= state.copiesTotal) return state
      return {
        ...state,
        phase: 'WORKING',
        deck: buildFoundryDeck(),
        copyIndex: state.copyIndex + 1,
        roundsDone: 0,
        proofsShuffled: false,
        currentCard: null,
        history: [
          ...state.history,
          { event: 'impression', index: state.copyIndex + 1, ts: Date.now() }
        ]
      }
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
  if (state.proofsShuffled) return UI.foundry.progress.late
  return fmt(UI.foundry.progress.round, {
    round: state.roundsDone + 1,
    total: FOUNDRY_TUNING.workingRounds
  })
}
