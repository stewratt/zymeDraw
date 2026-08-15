// The deck — v3 session script. A PURE reducer: no Fabric, no DOM, no React.
// It holds card ids and filenames, never images or canvas objects. All the
// session's randomness (deck shuffles) also lives here, so this one file is
// the complete rulebook.
//
// The arc:
//   OPENING_PICK   a fixed grid of images; take two — place one + stash
//                  one, or place both (no stash beat that session). Stashing
//                  slips the Stash Return card into the whole deck at once
//   PLACEMENT      arrange the placed image(s); End bakes
//   WORKING        deal cards from the literal shuffled deck, one round each
//   STASH_RETURN_NOTICE  the Stash Return card, drawn (any round, even the
//                  first): an interstitial beat;
//                  click to acknowledge (Enter is dead here) before placement
//   STASH_RETURN   the acknowledged stash, now a live placement session
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
  actOneRounds: 4, // rounds in Act I (the progress label's first act)
  actTwoRounds: 2, // rounds after that before death cards are shuffled in
  deathCount: 3 // death cards shuffled into the remaining deck
}

// The mod deck: one entry per card design, expanded by copy count and
// shuffled at session start. Rebalancing the deck = editing this array
// (target ratios in archive/version_3_design.md §8–9). Names and descriptions
// live in cardText.js — labels are derived from it below, so a rename
// happens there, never here.
export const MOD_CARDS = [
  // House deck thinned to the 20-card cap (2026-07-10, Stew's cuts):
  // Ghost 2→1, Stain 2→1, Blur 1→2. The pool is unchanged — a built deck
  // may still run any design up to the deck editor's max copies.
  // `rarity` (issue #42, Stew's per-card call 2026-07-18) is a hardcoded
  // statement of how weird/oblique a card's ACTION is — no relation to
  // copies, deck presence, or print run. Two tiers for real cards:
  // 'common' (legible, everyday — Blur) and 'scarce' (strange, oblique —
  // Subliminal Etch). The Coda keeps its own 'singular' mark, set in
  // rarity.js by family, never here. Foundry-only: the glyph prints on
  // cast faces, not on in-session Card.jsx faces (issue #42, Q3).
  { id: 'ghost', copies: 1, rarity: 'common' }, // Graft × Rise
  { id: 'stain', copies: 1, rarity: 'common' }, // Graft × Sink
  { id: 'stamp', copies: 2, rarity: 'common' }, // Graft (cutout)
  // Pool-only (Stew's standing rule, 2026-07-12: new cards never join the
  // starter deck — they wait in the Deck editor's pool to be swapped in).
  { id: 'reverberate', copies: 1, rarity: 'scarce' }, // Graft (cutout) × stamp brush — impressions along the stroke
  { id: 'rails', copies: 1, rarity: 'common' }, // Stencil × solid
  { id: 'char', copies: 1, rarity: 'common' }, // Stencil × Sink
  { id: 'deeper', copies: 0, rarity: 'common' }, // Re-frame, inward
  // Re-frame swap (2026-07-15, Stew): Deeper out of the house deck, Closer
  // in — the honest sibling (no detail restore, enlargement keeps its grain)
  // is now the default re-frame. Both stay in the pool.
  { id: 'closer', copies: 1, rarity: 'common' }, // Re-frame, inward, no restoration
  // The pair's third sibling: the new frame is chosen with a 3D camera instead
  // of a 2D crop. Pool-only, and it wants the sidecar's splat extra installed
  // on the machine.
  { id: 'splatt', copies: 0, rarity: 'scarce' }, // Re-frame × depth cast — orbit, then re-photograph
  // Rack retired (2026-07-05): flipping a piece you've worked several
  // rounds never felt worth doing. Card + registry entry stay in place;
  // re-add this line to deal it again.
  // { id: 'rack', copies: 1 }, // Re-frame, neutral
  // Lift is pool-only (Stew, deciding #33's open question at the merge):
  // 0 house copies keeps the cap at 20; the Deck editor's pool lists every
  // entry here, so built decks may still run it.
  { id: 'lift', copies: 0, rarity: 'scarce' }, // Lift session — pixels change address, not value
  // The fracture family's exemplar (cards_plan §4): geometric tiles of the
  // piece strewn by a scatter brush. Medium rarity on the weirdness dial —
  // 1 is a suggested balance, not a cap; the Deck editor may run more.
  { id: 'fracture', copies: 0, rarity: 'scarce' }, // Grid displacement × mask brush — the piece slides apart
  // The fracture family's liquid sibling (issue #125): the same piece, bent on
  // a control lattice instead of broken on hard seams. Pool-only like the rest
  // of the family.
  { id: 'gwarp', copies: 0, rarity: 'scarce' }, // Mesh warp — the whole sheet bends, nothing is cut
  { id: 'dust', copies: 2, rarity: 'common' }, // Reveal × deposit
  { id: 'bruise', copies: 1, rarity: 'common' }, // Reveal × Bruise
  { id: 'blur', copies: 2, rarity: 'common' }, // Reveal × blur — provisional (§6.3)
  { id: 'smieer', copies: 0, rarity: 'common' }, // Smieer — the piece dragged into itself (pool-only)
  { id: 'steep', copies: 1, rarity: 'common' }, // Wash × Sink
  { id: 'hue', copies: 1, rarity: 'common' }, // Wash (hue)
  { id: 'cure', copies: 1, rarity: 'common' }, // Wash × Cure
  { id: 'etch', copies: 0, rarity: 'scarce' }, // Pixel glyph, hidden at the grain — pool-only
  // The deck itself (v4 notes §5.1–5.2, §5.9): deck modifications, dealt
  // by chance. `family: 'deck'` color-codes their faces apart from the
  // image cards (cardFamily below). Reaching into the deck itself is the
  // most oblique thing a card does — all scarce.
  { id: 'searcher', copies: 1, family: 'deck', rarity: 'scarce' }, // Tutor: the remains open, take one
  { id: 'skim', copies: 2, family: 'deck', rarity: 'scarce' }, // Scry: see the top, keep or bury
  { id: 'delay', copies: 1, family: 'deck', rarity: 'scarce' } // The right to set the first Coda aside
  // Stashed until Stew trains his own style model — the demo ONNX styles
  // don't look good enough to ship. Card files, registry entries, and the
  // /style sidecar endpoint all stay in place; re-add these lines to deal
  // them again. See CLAUDE.md §0 (style-transfer experiment).
  // { id: 'transfer', copies: 2 },
  // { id: 'shatteredTransfer', copies: 2 }
].map((card) => ({ label: CARD_TEXT[card.id]?.name ?? card.id, ...card }))

export const DEATH_CARD = { id: 'coda', label: CARD_TEXT.coda.name }

// The stash's return, as a card (issue #88). Deliberately NOT a MOD_CARD:
// no deck is built with it and the deck editor never offers it — the session
// shuffles exactly one in when the opening pick commits (issue #113), and
// only if something was stashed.
// Its own `kind` keeps it out of the mod paths that would misread it (a
// Searcher can't tutor it out; it isn't a round the way a mod is).
export const STASH_RETURN_CARD = { id: 'stashReturn', label: CARD_TEXT.stashReturn.name }

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

// Slip one card into a deck at a uniformly random position — the honest
// reinsert every mechanic here shares (never the bottom, which would be
// lasting order-knowledge). No kept-top exception is needed: its only caller
// runs at the opening pick, before a single card has been dealt, so there is
// no Skim promise to keep (the death shuffle guards its own, inline).
function shuffleIn(deck, card) {
  const rest = [...deck]
  const at = Math.floor(Math.random() * (rest.length + 1))
  rest.splice(at, 0, card)
  return rest
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
    stashReturned: false, // the Stash Return card was drawn and the stash placed
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
      // Take two: place one + stash one (its return card joins the deck right
      // here), or place both — then the session simply has no stash beat and
      // no card is made (DEAL's stash branch guards on stash.length too).
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
        // The stash's return joins the whole deck now, not when Act I ends
        // (issue #113 — friend feedback: the Coda kept beating the stash
        // home). One Stash Return card at a uniformly random position, so it
        // may come up round 1, much later, or never (if the Coda surfaces
        // first the stash is lost and the session exports without it). It is
        // visible in REMAINS like any other card: set-knowledge is free, only
        // the Coda hides.
        deck:
          stashed.length > 0
            ? shuffleIn(state.deck, { ...STASH_RETURN_CARD, kind: 'stash' })
            : state.deck,
        history: [
          ...state.history,
          { event: 'pick', placed, stashed, ts: Date.now() }
        ]
      }
    }

    // The stash-return beat (issue #51): acknowledge the notice to bring the
    // stash in, turning the interstitial into the live placement session.
    // The card that opened the beat is spent as the placement goes live — it
    // was already written into the record when it was drawn.
    case 'ACK_STASH_RETURN': {
      if (state.phase !== 'STASH_RETURN_NOTICE') return state
      return { ...state, phase: 'STASH_RETURN', currentCard: null }
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
      if (card.kind === 'stash') {
        // The stash's return, drawn (issue #88). Like the Coda, the DEAL
        // itself decides the phase: the card turns over on the notice beat
        // (issue #51) rather than taking a round of its own, so the beat is
        // still click-only — Enter can't blow through the re-encounter. Its
        // record entry is written here, where it was spent.
        if (state.stash.length === 0) return { ...state, deck } // nothing to return
        return {
          ...state,
          phase: 'STASH_RETURN_NOTICE',
          deck,
          currentCard: card,
          toPlace: state.stash,
          history: [
            ...state.history,
            { event: 'card', cardId: card.id, ts: Date.now() }
          ]
        }
      }
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
      // Keep it where it lies — the next deal. The deck doesn't move.
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

      // Skim's promise, owed by the death shuffle below: a card just kept on
      // top stays on top, so nothing may be slipped in ahead of it.
      const keptTop = state.skim?.choice === 'kept'
      // Whether the deck is out of cards that can take a round — the death
      // shuffle's fallback trigger. A lone Stash Return card doesn't count
      // (it costs no round), or the session would be left with nothing to
      // draw once the stash is placed.
      const outOfCards = !next.deck.some((c) => c.kind === 'mod')

      const deck = next.deck

      // End of Act II (or an empty deck, if the knobs ever outrun it):
      // shuffle the death cards into whatever remains. From here the session
      // ends whenever one surfaces — odds rise naturally as the deck thins.
      const actsDone =
        roundsDealt >= TUNING.actOneRounds + TUNING.actTwoRounds
      if (!state.deathShuffled && (actsDone || outOfCards)) {
        // The death shuffle must not break Skim's promise: a card just
        // kept on top stays on top — the deaths join the deck behind it.
        if (keptTop && deck.length > 0) {
          const [kept, ...rest] = deck
          return {
            ...next,
            deck: [kept, ...shuffle([...rest, ...deathCards()])],
            deathShuffled: true
          }
        }
        return {
          ...next,
          deck: shuffle([...deck, ...deathCards()]),
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
  [...MOD_CARDS, DEATH_CARD, STASH_RETURN_CARD].map((c) => [c.id, c.label])
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

// The undealt deck as an unordered multiset — one entry per design with a
// count, sorted by label. ONLY the Coda is filtered out, and order is
// stripped HERE, in deck logic, so the UI cannot leak what it never
// receives: the Coda's place in the deck stays a genuine surprise (that it
// is armed at all is already public via progressLabel). Everything else is
// set-knowledge, which is free — including the Stash Return card once it has
// been shuffled in (issue #88): that it is coming is known, when is not.
export function remainingCounts(state) {
  return countsOf(state.deck, (card) => card.kind !== 'death')
}

// What a tutor may TAKE, which is narrower than what REMAINS may SHOW: mods
// only. The Coda is out for the obvious reason; the Stash Return card is out
// because when the stash comes home is meant to be chance (issue #88) — a
// player-timed recall is a different mechanic (#18), not a side effect of
// Searcher. The reducer's PICK_FROM_DECK enforces this too; this selector
// just keeps the UI from offering a card it would refuse.
export function findableCounts(state) {
  return countsOf(state.deck, (card) => card.kind === 'mod')
}

function countsOf(deck, include) {
  const counts = new Map()
  for (const card of deck) {
    if (!include(card)) continue
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
