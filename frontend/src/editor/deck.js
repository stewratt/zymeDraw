// The deck — v3 session script. A PURE reducer: no Fabric, no DOM, no React.
// It holds card ids and filenames, never images or canvas objects. All the
// session's randomness (deck shuffles) also lives here, so this one file is
// the complete rulebook.
//
// The arc:
//   OPENING_PICK   a fixed grid of images; take two — place one + stash
//                  one, or place both (no stash beat that session)
//   PLACEMENT      arrange the placed image(s); End bakes
//   WORKING        deal cards from the literal shuffled deck, one round each
//   STASH_RETURN   after Act I, the stash comes back as one placement session
//   WORKING        Act II; then death cards are shuffled into whatever deck
//                  remains — dealing one ends the session instantly
//   CODA_CHOICE    only if Delay was committed: the dealt Coda waits for a
//                  choice — accept the ending, or set it aside (once)
//   COMPLETE       the piece is finished; export
//
// "Death card" is the design term; on screen the card is called Coda.

import { CARD_TEXT } from './cardText.js'
import { UI, fmt } from '../copy/uiText.js'

// Every pacing number lives here.
export const TUNING = {
  openingGrid: 24, // images dealt into the opening grid (6×4)
  actOneRounds: 4, // card rounds before the stash returns
  actTwoRounds: 2, // rounds after that before death cards are shuffled in
  deathCount: 3 // death cards shuffled into the remaining deck
}

// The mod deck: one entry per card design, expanded by copy count and
// shuffled at session start. Rebalancing the deck = editing this array
// (target ratios in archive/version_3_design.md §8–9). Names and descriptions
// live in cardText.js — labels are derived from it below, so a rename
// happens there, never here.
export const MOD_CARDS = [
  { id: 'ghost', copies: 2 }, // Graft × Rise
  { id: 'stain', copies: 2 }, // Graft × Sink
  { id: 'stamp', copies: 2 }, // Graft (cutout)
  { id: 'rails', copies: 1 }, // Stencil × solid
  { id: 'char', copies: 1 }, // Stencil × Sink
  { id: 'deeper', copies: 2 }, // Re-frame, inward
  // Rack retired (2026-07-05): flipping a piece you've worked several
  // rounds never felt worth doing. Card + registry entry stay in place;
  // re-add this line to deal it again.
  // { id: 'rack', copies: 1 }, // Re-frame, neutral
  { id: 'dust', copies: 2 }, // Reveal × deposit
  { id: 'bruise', copies: 1 }, // Reveal × Bruise
  { id: 'blur', copies: 1 }, // Reveal × blur — provisional (§6.3)
  { id: 'steep', copies: 1 }, // Wash × Sink
  { id: 'hue', copies: 1 }, // Wash (hue)
  { id: 'cure', copies: 1 }, // Wash × Cure
  { id: 'etch', copies: 1 }, // Pixel glyph, hidden at the grain
  // The deck itself (v4 notes §5.1–5.2, §5.9): deck modifications, dealt
  // by chance. `family: 'deck'` color-codes their faces apart from the
  // image cards (cardFamily below).
  { id: 'searcher', copies: 1, family: 'deck' }, // Tutor: the remains open, take one
  { id: 'skim', copies: 1, family: 'deck' }, // Scry: see the top, keep or bury
  { id: 'delay', copies: 1, family: 'deck' } // The right to set the first Coda aside
  // Stashed until Stew trains his own style model — the demo ONNX styles
  // don't look good enough to ship. Card files, registry entries, and the
  // /style sidecar endpoint all stay in place; re-add these lines to deal
  // them again. See CLAUDE.md §0 (style-transfer experiment).
  // { id: 'transfer', copies: 2 },
  // { id: 'shatteredTransfer', copies: 2 }
].map((card) => ({ label: CARD_TEXT[card.id]?.name ?? card.id, ...card }))

export const DEATH_CARD = { id: 'coda', label: CARD_TEXT.coda.name }

// A deck spec is the deck editor's entire output: [{ id, copies }], nothing
// more (cards_plan.md §6 — the room is UI; this reducer never learns about
// it). Labels and families are re-derived here from MOD_CARDS, so a spec
// can't spoof them, and a saved deck naming a since-retired id degrades by
// dropping that line, never by crashing. An empty/unknown spec falls back
// to the house deck (MOD_CARDS verbatim).
const MOD_CARD_INDEX = new Map(MOD_CARDS.map((c) => [c.id, c]))

function resolveSpec(deckSpec) {
  if (!deckSpec?.length) return MOD_CARDS
  const out = []
  for (const { id, copies } of deckSpec) {
    const base = MOD_CARD_INDEX.get(id)
    if (base && copies > 0) out.push({ ...base, copies })
  }
  return out.length ? out : MOD_CARDS
}

// Fisher–Yates on a copy.
function shuffle(cards) {
  const out = [...cards]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildDeck(modCards) {
  const cards = []
  for (const { copies, ...card } of modCards) {
    // `variant` (1-based) is which of the card's copies this is — a card in
    // two copies may carry two distinct faces (see cardArt.js). It travels
    // with the card through the shuffle; the dealt card renders its own face.
    for (let n = 0; n < copies; n++) cards.push({ ...card, kind: 'mod', variant: n + 1 })
  }
  return shuffle(cards)
}

function deathCards() {
  return Array.from({ length: TUNING.deathCount }, () => ({
    ...DEATH_CARD,
    kind: 'death'
  }))
}

export function initialState(deckSpec = null) {
  return {
    phase: 'OPENING_PICK',
    deckSpec, // the spec this session was built from; RESTART rebuilds from it
    grid: [], // filenames offered in the opening pick (Editor samples them
    //           and reports back via SET_GRID — fetching is not deck logic)
    toPlace: [], // filenames being arranged in the current placement session
    stash: [], // filenames held back for the stash return
    deck: buildDeck(resolveSpec(deckSpec)), // the literal shuffled deck, dealt from the front
    roundsDealt: 0,
    stashReturned: false,
    deathShuffled: false,
    currentCard: null,
    skim: null, // Skim's round: null | { card, choice: null|'kept'|'buried' }
    delayHeld: false, // Delay committed: the first Coda may be set aside
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
      // Take two: place one + stash one (the stash returns after Act I), or
      // place both — then the session simply has no stash beat (COMMIT's
      // stash-return check already guards on stash.length).
      const legal =
        ((placed.length === 1 && stashed.length === 1) ||
          (placed.length === 2 && stashed.length === 0)) &&
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
        // Delay held (v4 notes §5.9): the ending becomes a choice, once.
        // Nothing joins the record yet — the event is written by whichever
        // resolution follows (ACCEPT_CODA / DELAY_CODA).
        if (state.delayHeld) {
          return { ...state, phase: 'CODA_CHOICE', deck, currentCard: card }
        }
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

    // The Coda choice (v4 notes §5.9): only reachable while Delay is held.
    // Accepting with the right unspent is the strongest ending — the piece
    // was signed, not stopped.
    case 'ACCEPT_CODA': {
      if (state.phase !== 'CODA_CHOICE') return state
      return {
        ...state,
        phase: 'COMPLETE',
        history: [
          ...state.history,
          { event: 'death', cardId: state.currentCard.id, ts: Date.now() }
        ]
      }
    }

    case 'DELAY_CODA': {
      // Not yet. The Coda slips back in at a random position — the same
      // honest reinsert as Skim's bury (never the bottom) — and the next
      // deal is blind: it can come straight back, and the right is spent.
      if (state.phase !== 'CODA_CHOICE') return state
      const deck = [...state.deck]
      const at = Math.floor(Math.random() * (deck.length + 1))
      deck.splice(at, 0, state.currentCard)
      return {
        ...state,
        phase: 'WORKING',
        deck,
        currentCard: null,
        delayHeld: false,
        history: [...state.history, { event: 'delayed', ts: Date.now() }]
      }
    }

    case 'PICK_FROM_DECK': {
      // Searcher, the tutor (v4 notes §5.1): while Searcher is in hand the
      // remains are open, and the chosen mod becomes this round — Searcher
      // itself never touches the canvas. Only mods are findable, so the Coda
      // can never be picked even if the UI misbehaved. The choice joins the
      // record: spentCards shows Searcher (searched) and then the card it took.
      if (state.phase !== 'WORKING' || state.currentCard?.id !== 'searcher') {
        return state
      }
      const i = state.deck.findIndex(
        (c) => c.kind === 'mod' && c.id === action.cardId
      )
      if (i === -1) return state
      const deck = [...state.deck]
      const [card] = deck.splice(i, 1)
      return {
        ...state,
        deck,
        currentCard: card,
        history: [
          ...state.history,
          { event: 'searched', cardId: card.id, ts: Date.now() }
        ]
      }
    }

    // Skim, the scry (v4 notes §5.2): the smallest unit of order-knowledge
    // and order-control, sold together as one dealt card. It sees
    // EVERYTHING on top — the Coda included, once armed; that is the paid,
    // one-card exception to "death timing stays secret" (decided
    // 2026-07-06). The reveal lives in state.skim only for the round; the
    // UI shows it while Skim is in hand and COMMIT clears it.
    case 'SKIM': {
      if (state.phase !== 'WORKING' || state.currentCard?.id !== 'skim') {
        return state
      }
      if (state.skim) return state
      return { ...state, skim: { card: state.deck[0] ?? null, choice: null } }
    }

    case 'SKIM_KEEP': {
      // Leave it where it lies — the next deal. The deck doesn't move.
      if (!state.skim?.card || state.skim.choice) return state
      return { ...state, skim: { ...state.skim, choice: 'kept' } }
    }

    case 'SKIM_BURY': {
      // Slipped back in somewhere random, NOT the bottom — bottom would
      // grant lasting order-knowledge ("it comes last"), which the §2
      // policy forbids. The knowledge you bought expires as you bury.
      if (!state.skim?.card || state.skim.choice) return state
      const [top, ...rest] = state.deck
      const at = Math.floor(Math.random() * (rest.length + 1))
      rest.splice(at, 0, top)
      return { ...state, deck: rest, skim: { ...state.skim, choice: 'buried' } }
    }

    case 'COMMIT': {
      if (state.phase !== 'WORKING' || !state.currentCard) return state
      const card = state.currentCard
      const roundsDealt = state.roundsDealt + 1

      const next = {
        ...state,
        roundsDealt,
        currentCard: null,
        skim: null,
        // Ending the Delay round is what grants the right — one code path
        // whether it was dealt, searched, or skim-kept.
        delayHeld: state.delayHeld || card.id === 'delay',
        history: [
          ...state.history,
          { event: 'card', cardId: card.id, ts: Date.now() }
        ]
      }

      // End of Act I: the stash comes back as one placement session.
      if (
        roundsDealt >= TUNING.actOneRounds &&
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
        // The death shuffle must not break Skim's promise: a card just
        // kept on top stays on top — the deaths join the deck behind it.
        if (state.skim?.choice === 'kept' && next.deck.length > 0) {
          const [kept, ...rest] = next.deck
          return {
            ...next,
            deck: [kept, ...shuffle([...rest, ...deathCards()])],
            deathShuffled: true
          }
        }
        return {
          ...next,
          deck: shuffle([...next.deck, ...deathCards()]),
          deathShuffled: true
        }
      }
      return next
    }

    case 'RESTART':
      return initialState(state.deckSpec)

    default:
      return state
  }
}

// ---- Derived views (v4) ----
// Pure selectors for the deck overlay. The UI never reads history or the
// deck array directly — what these return is exactly what a user may know.

const CARD_LABELS = Object.fromEntries(
  [...MOD_CARDS, DEATH_CARD].map((c) => [c.id, c.label])
)

// The two families of modification card (v4): image cards act on the
// canvas; deck cards (Searcher, Skim, Delay) act on the deck itself. Card.jsx
// color-codes faces by family until Stew's designed art carries the
// distinction. The Coda is neither — it has its own face.
const DECK_FAMILY_IDS = new Set(
  MOD_CARDS.filter((c) => c.family === 'deck').map((c) => c.id)
)
export function cardFamily(id) {
  return DECK_FAMILY_IDS.has(id) ? 'deck' : 'image'
}

// The cards spent so far, in dealt order — the sequence view. Includes the
// Coda once the session is COMPLETE (it already happened); never the card
// still in hand (it hasn't been committed). A Searcher round reads as two
// entries: Searcher tagged "searched", then the card it took.
export function spentCards(state) {
  const out = []
  for (const ev of state.history) {
    if (ev.event === 'searched') {
      out.push({ id: 'searcher', label: CARD_LABELS.searcher, kind: 'mod', tag: 'searched' })
      continue
    }
    if (ev.event === 'delayed') {
      // The Coda that came and was set aside — part of the piece's story.
      out.push({ id: 'coda', label: CARD_LABELS.coda, kind: 'death', tag: 'set aside' })
      continue
    }
    if (ev.event !== 'card' && ev.event !== 'death') continue
    out.push({
      id: ev.cardId,
      label: CARD_LABELS[ev.cardId] ?? ev.cardId,
      kind: ev.event === 'death' ? 'death' : 'mod'
    })
  }
  return out
}

// The undealt modification cards as an unordered multiset — one entry per
// design with a count, sorted by label. Death cards are filtered out and
// order is stripped HERE, in deck logic, so the UI cannot leak what it
// never receives: the Coda's place in the deck stays a genuine surprise
// (that it is armed at all is already public via progressLabel).
export function remainingCounts(state) {
  const counts = new Map()
  for (const card of state.deck) {
    if (card.kind !== 'mod') continue
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: CARD_LABELS[id] ?? id, count }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Short human label for where the session stands. Derived, never stored.
export function progressLabel(state) {
  if (state.phase !== 'WORKING') return null
  if (state.deathShuffled) return UI.progress.late
  const { actOneRounds, actTwoRounds } = TUNING
  if (state.roundsDealt < actOneRounds) {
    return fmt(UI.progress.actOne, { round: state.roundsDealt + 1, total: actOneRounds })
  }
  return fmt(UI.progress.actTwo, { round: state.roundsDealt - actOneRounds + 1, total: actTwoRounds })
}
