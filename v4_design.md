# v4 design — Card history & the standardized card panel

> Branch `v4`, off `main` (2026-07-05). The v4 exploration: make the deck
> *legible*. Give the piece a visible record of the cards spent and a
> (partial) view of what could still come, and standardize the card visual
> so a real designed deck can drop in cleanly.
>
> Read this top-to-bottom before doing v4 work. Companion to CLAUDE.md §0.

---

## 1. Why — the design intent

Today the deck is opaque. The current "card" is a text label in an
unevenly-padded box (`card-face` in `DeckPanel.jsx`), and there is no way to
look back at what was played or think about what remains. You draw, you
commit, you forget.

Stew's insight: **awareness of the deck is a creative lever.** If you can see
what has been *spent* and what *could still come*, you make different
compositional choices — you leave room for a card you know is still in there,
or you commit harder because you know the palette is nearly exhausted. It
adds a deliberate, planful dimension without breaking commitment (you still
can't undo, and you still can't know *when* things come).

Two things ship together because they depend on each other:

1. **A standardized card visual.** Stew is designing a uniform deck of card
   art at **745×1040** (standard TCG proportions, 0.716:1). The panel must
   render cards at a consistent scale from that art — replacing the current
   text box — so the history view and the round view both look like a real
   deck.
2. **A card-history overlay.** A button opens a menu showing the cards
   **played, in sequence, with their art**, and the cards that **remain** in
   the deck to potentially be pulled.

---

## 2. Decisions locked with Stew (2026-07-05)

1. **Remaining reveal = mods yes, Coda hidden.** The "remains" view shows the
   undealt *modification* cards as an **unordered set with counts**, so you
   can plan compositionally. The **Coda is never shown** in that view — death
   timing stays a genuine surprise. (`progressLabel` already whispers "the
   Coda is in the deck" once it's armed; that stays as the only tell.)
2. **Order is never revealed.** The deck stays shuffled. Both views are about
   *which* cards, never *when*. Played = ordered (it already happened).
   Remaining = unordered multiset.
3. **One card face per design.** Each card *id* (ghost, stain, silt, deeper,
   coda, …) maps to exactly one art file — ~14 faces total. Copies of a card
   look identical. This matches how `deck.js` defines the deck (id + copy
   count) and keeps the mapping a trivial `id → image`.
4. **Wire placeholders now.** Build against the `cardPNG/` stand-ins so the
   redesigned panel and overlay are fully visual and testable immediately;
   Stew's real art drops into the same asset folder later, no code change.

Open (parked, not blocking): a hotkey for the overlay; whether to show the
opening image-pick in the spent sequence; death-crop (parked since v2).

**Analysis amendments (2026-07-05, pre-build review):**

- **Art loads via `import.meta.glob`, not static imports.** Static imports of
  gitignored files would fail the build on any machine without them. The glob
  picks up whatever `<id>.png` files exist; missing art → text face. Real art
  drops in file-for-file with zero code change.
- **Gitignore already handled.** The repo has a global `*.png` ignore, so
  `cardPNG/` and the placeholders are un-committable today. Committing real
  art later needs a `!frontend/src/assets/cards/*.png` negation.
- **"PLAYED" broke the §1 tone invariant** (avoid "play"). The sequence
  section is **SPENT**; the header button is **deck**. Selector renamed
  `spentCards`.
- **The card in hand** (dealt, not yet committed) is in neither history nor
  the deck — it appears at the end of the sequence marked *in hand*, dimmed.
- **The Coda ends the sequence** once the session is COMPLETE — it already
  happened, so showing it leaks nothing and closes the narrative.

---

## 3. What already exists (no reducer change needed)

`deck.js` is a pure reducer and already records everything the views need:

- **`state.history`** — ordered event log. Relevant events:
  - `{ event: 'pick', placed, stashed }` — the opening take-two
  - `{ event: 'placement' }` / `{ event: 'stash-return' }`
  - `{ event: 'card', cardId }` — a modification card committed
  - `{ event: 'death', cardId }` — the Coda dealt (session end)
- **`state.deck`** — the ordered, undealt remainder (dealt from the front).
  Each entry is `{ id, label, kind }`, `kind` ∈ `'mod' | 'death'`.

So **both features are pure derivations of current state.** v4 adds *pure
selectors* to `deck.js` (order-stripping, death-filtering happen here so they
can never leak into the UI) and new React components — the reducer's data
model and rulebook are untouched. This respects the §5.1 purity invariant.

The two selectors (pure, no Fabric/DOM/React — they belong in `deck.js`):

```js
// The cards spent so far, in dealt order, as {id, label, kind} — the
// sequence view. Derived from history 'card' events, plus the 'death'
// event once the session is COMPLETE (the Coda closes the sequence).
export function spentCards(state) { … }

// The undealt modification cards as an unordered multiset:
//   [{ id, label, count }], sorted stably (by label).
// Death cards are filtered OUT here — the Coda is never revealed. Order is
// stripped here so the UI literally cannot show sequence.
export function remainingCounts(state) { … }
```

---

## 4. Architecture

### 4.1 Card art assets

Card faces are **app assets**, not user-input images (which live in the
runtime-chosen input folder and flow through `/api/images`). They belong in
the frontend bundle, keyed by card id.

- **Home:** `frontend/src/assets/cards/<id>.png` (e.g. `ghost.png`,
  `silt.png`, `coda.png`). Bundled and content-hashed by Vite.
- **Loader:** `frontend/src/editor/cardArt.js` — `import.meta.glob` over
  `../assets/cards/*.png` (eager), exposing `getCardArt(id)` → URL or `null`.
  The glob only binds files that exist, so a clone without the (gitignored)
  art still builds and runs — `<Card>` falls back to the text face. Real art
  replaces placeholders file-for-file with no code change.
- **Placeholders (now):** the repo root already has `cardPNG/` — 208
  stand-ins (four real TCG decks, all 745×1040). For the build, copy ~14 of
  them into `frontend/src/assets/cards/` renamed to card ids
  (deterministic, documented in the manifest). These are **throwaway,
  copyrighted stand-ins** — see §6 on git hygiene.

Aspect ratio is fixed everywhere via CSS `aspect-ratio: 745 / 1040`; the art
is `object-fit: cover` (or `contain`) inside that frame so any near-ratio
source scales cleanly without distorting the panel.

### 4.2 The `<Card>` component (the standardization)

New `frontend/src/editor/Card.jsx` — one reusable, fixed-proportion card. It
is the single source of card visuals; nothing else hardcodes card geometry.

- Props: `id`, `label`, `kind`, optional `size` (panel | tile | large),
  optional `count` badge, optional `dimmed` (for context).
- Renders the art from `getCardArt(id)` at `aspect-ratio: 745/1040`. If no
  art, renders the current text face (kind eyebrow + label) inside the *same*
  frame — so uniform scale holds whether or not art exists yet.
- Consumed in three places, giving one consistent look:
  1. `DeckPanel` **THIS ROUND** (the dealt card) — replaces the bespoke
     `.card-face` box. Keeps the flip-in animation.
  2. `DeckPanel` **FINISHED** (the Coda) — same component, `large`.
  3. **History overlay** tiles — `tile` size, with `×N` count badges on the
     remaining set.

The current `.card-face` CSS (§editor.css:273–324) is replaced by
`.card` styles driven by aspect-ratio; the flip animation is preserved.

### 4.3 The history overlay

New `frontend/src/editor/HistoryOverlay.jsx` — modeled on the existing
`KeysReference.jsx` (centered modal, Esc/click-anywhere closes, swallows app
keys at the capture phase so nothing fires behind it). Two sections:

- **SPENT — in sequence.** `spentCards(state)` → a row of `<Card>` tiles in
  dealt order, left-to-right, the narrative of the piece so far. The card
  currently in hand (dealt, uncommitted) trails the sequence dimmed and
  tagged *in hand*. Once COMPLETE, the Coda closes the sequence. (Decision
  parked: whether to also mark the opening pick / stash-return as non-card
  chips in the timeline. Default: cards only, keep it clean.)
- **REMAINS — in no order.** `remainingCounts(state)` → `<Card>` tiles with
  `×N` badges, unordered. A muted footer once `state.deathShuffled` is true:
  *"…and the Coda is somewhere in here"* — armed, never counted, never shown
  as a face.

Empty/edge states: before any card is spent, SPENT shows a muted "nothing
yet." When the mods are exhausted, REMAINS says so.

### 4.4 Entry points

- **Header button** `deck`, beside the existing `keys` button
  (`Editor.jsx` header) — always available.
- **Deal panel button.** The most useful moment to consult the deck is when
  you're *deciding* — the `AwaitingDeal` ("THE DECK") panel. Add a prominent
  "View deck" affordance there too. (Both open the same overlay; overlay open
  state lives in `Editor.jsx` like `keysOpen`.)

`Editor.jsx` gains one `useState` (`historyOpen`) and renders
`<HistoryOverlay state={state} onClose=… />` — mirroring the `keysOpen`
pattern exactly. **No per-card branching**; the overlay reads generic state
and the id→art manifest. Respects §5.2.

### 4.5 Card zoom (added 2026-07-05)

Any card face can be clicked to view it larger: `Card` takes an optional
`onClick` (cursor zoom-in, propagation stopped so a tile click never falls
through to a close-on-click sheet), and `CardZoom.jsx` renders the enlarged
face + name as a modal at `z-index: 50` — above the deck overlay's 40, so
zooming a tile layers over the sheet. Esc backs out **one level at a time**:
the zoom first, then the sheet (HistoryOverlay's key handler branches on
whether a zoom is open). Wired on the dealt card (THIS ROUND), the Coda
(FINISHED), and every tile in the deck overlay.

---

## 5. Build order (phased, checkpoint at each — §2 working agreement)

| Phase | Ships | Checkpoint |
|---|---|---|
| **1 — Art plumbing** | `assets/cards/` + `cardArt.js` glob loader + `getCardArt(id)`; copy ~14 `cardPNG/` placeholders renamed to ids (already gitignored via `*.png`). | `getCardArt('ghost')` resolves to a URL; missing id → `null`. |
| **2 — `<Card>` + panel redesign** | `Card.jsx` + CSS (aspect-ratio frame, fallback text face, flip preserved). Swap into DeckPanel THIS ROUND + FINISHED. | Panel cards render at uniform scale with placeholder art on screen. |
| **3 — Selectors** | `spentCards`, `remainingCounts` pure selectors in `deck.js`. | Order-stripped, Coda-filtered multiset out; spent list in order. |
| **4 — Deck overlay** | `HistoryOverlay.jsx` (KeysReference pattern) + header `deck` button + deal-panel button + Editor `historyOpen` state. | Overlay shows spent sequence + remaining set; Coda never appears in REMAINS. |
| **5 — Polish** | Count badges, empty states, "Coda is in here" line, transitions, responsive grid, optional hotkey. | Reads well end-to-end; Stew verifies in browser. |

Stop after each phase, summarize, explain the one new concept, wait for
"continue" (§2).

**Status (2026-07-05): all five phases built in one pass at Stew's request
("implement the plan"). Selectors verified by simulated full session
(conservation, Coda-filtering, sequence order). Awaiting Stew's browser
verification before commit.** Note: the deck currently holds 18 mod cards,
not 19 — Rack's retirement (2026-07-05) predates this doc's count.

---

## 6. Notes, risks, hygiene

- **Git hygiene / copyright.** `cardPNG/` is ~250 MB of copyrighted TCG art
  and the renamed placeholders are the same. **Neither may be committed** —
  and the repo's existing global `*.png` gitignore already guarantees that.
  They're local-dev-only until Stew's real, ownable art replaces them; when
  real art lands, add `!frontend/src/assets/cards/*.png` to un-ignore it.
  The glob loader + `<Card>` fallback mean a machine without the
  placeholders still runs (text faces).
- **No reducer change.** Purity holds; only pure selectors are added to
  `deck.js`. Do not thread art or DOM into it.
- **No order leak.** The single most important correctness point: the
  remaining view derives from the ordered `state.deck` but must emit an
  unordered, death-filtered multiset. Keep that transform in the selector,
  tested, so no consumer can accidentally render sequence.
- **Performance is a non-issue at one-face-per-design** (~14 images, each
  shown small; the overlay reuses the same cached URLs). Real art should
  still be exported at a sane size (≤ ~200 KB/face) — note it for Stew.
- **Don't conflate card art with the image grids.** The opening pick and
  Ghost/Stamp grids show *input photos*, not deck cards. Card art is only
  for deck cards (mods + Coda).
- **Tone (§1 invariant).** Overlay copy stays studio/press, not arcade:
  "SPENT", "REMAINS", "the deck" — never "played", "history log", "score".
  "View the deck", "draw", "spent" are the register.

---

## 7. Where to start a fresh v4 session

1. Read CLAUDE.md §0, then this file.
2. `deck.js` — the state that both features derive from (§3).
3. `DeckPanel.jsx` `.card-face` (to be replaced) and `KeysReference.jsx`
   (the overlay pattern to copy).
4. Build Phase 1, checkpoint, wait for "continue."
