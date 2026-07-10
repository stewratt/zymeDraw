# card_anatomy.md — the card designer's contract

> How a card idea becomes code. Written for two readers: Stew, specifying
> a new card so the design is complete before implementation starts, and
> a Claude session, implementing one without re-deriving the framework.
> Read CLAUDE.md first (§1 tone, §5 patterns); this doc goes deeper on
> exactly one thing — the anatomy of a card. It records what is true in
> the code today; when the code moves, move this file with it.

---

## 1. What a card is

A card constrains the UI to exactly one action; the user works inside
that constraint, then presses **End**, which commits the result
permanently. Two design rules are load-bearing and non-negotiable:

- **Constraint outside, freedom inside.** No card may simply *do
  something to the image* with no room for judgment. A blur is a brush
  you compose with, not a filter that happens to you. Every card is a
  short session of intentional editing.
- **The zyme register.** One concrete process word — Bruise, Steep,
  Stain, Char, Cure. Never a settings-menu label. Subliminal Etch is the
  one deliberate two-word exception. All copy obeys the studio/darkroom
  tone (CLAUDE.md §1): a piece is *finished*, never *won*.

## 2. The two families

Every mod card belongs to one of two families (`cardFamily` in
`deck.js`; faces are color-coded by it until designed art carries the
distinction):

- **Canvas cards** modify the piece. Their round ends in the universal
  bake — the canvas flattens into the master raster.
- **Deck cards** (Cull, Skim, Delay) modify the *session*: ordering,
  knowledge, rights. They never touch the canvas (`skipBake`), and their
  mechanics live as reducer cases in `deck.js`, not in card code. They
  are marked `family: 'deck'` in `MOD_CARDS`.

The Coda is neither — it is the ending, not a modification.

## 3. The three tiers

Not a code field — a design vocabulary. The **copy count** in
`MOD_CARDS` is the rarity dial.

| Tier | What it is | Code cost | Examples |
|---|---|---|---|
| **Base** | One primitive, doing the obvious thing | A factory config or one small function | Dust, Stain, Hue |
| **Chained** | Primitives pre-composed into a flavor — a personality card | A factory config with attitude, or a small file on shared modules | Ghost (graft × screen), Char (stencil × sink), Bruise (reveal × HSV) |
| **Rare** | One hyper-specific action + one specific mechanic; usually 1 copy | A standalone behavior file, possibly a new registry capability | Subliminal Etch, Skim, Delay |

The intended shape of the deck: a spine of base cards, flavored chains
over them, and a few rare cards that each do one strange thing
completely. Balance passes edit `MOD_CARDS` only.

## 4. The primitive catalog

The set of modulations a card can be built from. A new card idea should
name its chain from this list; a card that needs a primitive not on the
list is proposing a framework extension — say so explicitly.

| Primitive | What it does | Machinery | Cost of a new card on it |
|---|---|---|---|
| **Graft** | An outside image joins the piece in a blend: grid pick → free transform + opacity + brightness/contrast + mask brush | `graftCardFactory.jsx` (`makeGraftCard` + `graftControls`) | One config object, ~15 lines (see `ghost.jsx`) — the blend mode is the flavor |
| **Reveal brush** | Paint a full-strength effected copy of the master into view; influence per stroke | `effectCardFactory.jsx` (`makeEffectCardHooks` + `BrushControls`) on `brushCore.createRevealSession` | One `applyEffect(effected, master)` pixel function + a Tools panel, ~35 lines (see `dust.jsx`) |
| **Stencil** | An image read as an alpha cutout of itself, filled with something | Hand-rolled per card (`rails.jsx`, `char.jsx`) — two cards in, no factory yet; a third earns one | A behavior file, ~5 KB |
| **Wash** | Whole-canvas color modification; **influence slider mandatory** (the one permitted global-modifier family) | Hand-rolled Fabric object per card (`steep.jsx`, `hue.jsx`, `cure.jsx`) — three cards in, no factory yet | A behavior file, ~2.5 KB |
| **Re-frame** | The master itself becomes the object: crop, flip | Hand-rolled (`deeper.jsx`; `rack.jsx`, retired) | A behavior file |
| **Lift** | A copy of a rectangle of the piece stamps down elsewhere; the source stays untouched — a clone, cropped where it runs off the edge | `liftSession.js` (`createLiftSession`) — marquee → floating copy → click stamps down; per-gesture undo | A thin behavior file (see `lift.jsx`); the fracture family (cards_plan §4) inherits the machinery |
| **Viewport glyph** | The card owns the viewport for its session, works at the master's grain | `etch.jsx` — the rare-tier exemplar | A standalone file; must restore the identity transform in commit AND cleanup |
| **Deck mechanic** | The deck's order, knowledge, or a held right becomes the round | Reducer cases in `deck.js` + an Overlay using `deckView`/`onDeckAction` | See §8 — the checklist is the cost |
| **Sidecar ML** | rembg cutout (Stamp), 4× detail restore (Deeper), style transfer (stashed) | FastAPI sidecar via `/api/ml/*`; async `commit` | Graceful degradation is a requirement — the session never blocks on ML |
| **Standing mask brush** | Conceal/restore/soften on placed images | `brushCore.createMaskSession` — not a card, but machinery grafts and placements arm | Free wherever an image is placed |

## 5. The four homes of a card

A card lives in exactly five places. Nothing else in the codebase may
know it exists — **never add per-card branches to `Editor.jsx` or
`DeckPanel.jsx`**.

0. **A `CARD_TEXT` entry** (`editor/cardText.js`) — the card's NAME and
   DESCRIPTION, the single place either is ever written. `deck.js`
   derives its labels from it, the card panel copy imports it, and
   Foundry pre-fills a cast's description box from it — renaming or
   rewording a card is one edit here, nowhere else.
   Alongside it: **a `CARD_GLOSS` line** (`tools/copy-editor.html`) — a
   literal, plain-language note of what the card *does*, keyed by id.
   **Naming convention:** the id is the display name slugified **at
   creation**, chosen deliberately, and normally never changes — the name
   is free to. That decoupling is the whole point: renaming a card is one
   `CARD_TEXT` edit, no code touched. If a name is genuinely *wrong* and
   settled, re-slugging the id is a legitimate move but a **deliberate
   refactor commit**, never a copy-editor edit — it renames the behavior
   file, the registry key, the `MOD_CARDS`/Foundry ids, the copy keys, the
   `CARD_GLOSS` key, and the face `<id>.png`, plus any event/tag/CSS names
   derived from it (the `dissolve→blur`, `silt→dust`, `turn→hue`,
   `cull→searcher` pass is the worked example). The gloss keeps the copy
   editor legible in the meantime, when a name has drifted from its id.
1. **A `MOD_CARDS` line** (`editor/deck.js`) — deck presence:
   `{ id, copies }` (the label is derived from `CARD_TEXT`), plus
   `family: 'deck'` for deck cards, plus a comment naming its anatomy
   (`// Reveal × deposit`). Removing a card from play = commenting this
   line out; the other homes stay (Rack and the transfers are the
   precedent).
2. **A registry entry** (`editor/cards/registry.jsx`) — behavior wiring:
   controls, defaults, hooks, and any optional capabilities (§6). A dev
   check at the bottom of the registry warns if a dealt id has no entry.
3. **A behavior file** (`editor/cards/<name>.jsx`) — one file exporting
   its hooks and its Tools component, built on the shared modules.
4. **A face PNG** (`frontend/src/assets/cards/<id>.png`, 745×1040) —
   optional at first; `Card.jsx` renders a text face until it exists.
   All card geometry goes through `Card.jsx`; nothing else hardcodes it.
   **Per-copy variants:** a card dealt in N copies may carry N distinct
   faces — copy 1 = `<id>.png`, copy 2 = `<id>.2.png`, … (bare = copy 1,
   `.n` = copy n, generalizing to 3x+). Extra variants are **opt-in**:
   `cardArtSources` (`editor/cardArt.js`) tries the variant face first and
   falls back to the bare `<id>.png` within each source tier, so a set
   that ships only one design has every copy borrow it — no special case,
   just the next link in the same error-walk that lets a set omit a card.
   `deck.js`'s `buildDeck` tags each copy with a 1-based `variant` that
   rides the shuffle; only the *dealt* card renders its variant, the deck
   overlay stays on the base face. Faces come out of Foundry as a run of
   impressions (`stain_i1_…`, `stain_i2_…`); curate them into a set as
   `stain.png` + `stain.2.png`.

## 6. The registry contract

`Editor.jsx` is a generic dispatcher: it looks up
`cardRegistry[card.id]` and calls hooks at the right times. After a
card's `commit`, Editor performs the **universal bake** — cards never
flatten anything themselves; their job is only to set up and adjust
temporary objects during their session.

**Lifecycle** (all optional; a card may have none — see `delay.jsx`):

- `begin(ctx) → session` — set up the canvas. `ctx`: `canvas`, `master`,
  `controls`, `imageList`, `canvasWidth/Height`, `report(patch)` (write
  to the `info` object Tools/Overlay render), `setControl(key, value)`,
  `isCancelled()` (check after every await — restarts must not leave
  objects behind). The returned session is opaque; Editor only carries it.
  - *begin may await the user* (Ghost's pick, Skim's choice): report a
    resolver via `ctx.report({ done: resolve })` and End stays disabled
    until it fires.
- `update(ctx)` — a control changed. `ctx`: `canvas`, `master`,
  `controls`, `session`, `canvasWidth/Height`. Brush cards just refresh
  a controls ref (settings are per-stroke); object cards re-set Fabric
  props.
- `commit(ctx)` — End was pressed: finalize temp objects (usually: drop
  the brush, leave the result for the bake). *May be async* (Deeper
  awaits the sidecar); Editor awaits it and shows "Committing…".
- `cleanup(ctx)` — the card was abandoned (Restart): remove everything
  begin added.

**Declarations:**

- `controls: [...]` + `defaultControls: {...}` — what the panel shows.
  Control *names* carry contracts (§7).
- `Tools` — the panel component: props `{ controls, info, ready,
  onControlChange }`.
- `Overlay` — a component over the canvas area while the card is live.
  Same props as Tools, plus `deckView` (deck selector outputs only),
  `onDeckAction` (the fenced dispatch), and `workUrl` (the latest
  committed state as an image — overlays cover the canvas, so a card
  whose decision is about the piece shows the piece).
- `randomize: (defaults) => defaults` — per-deal randomized opening,
  beyond the automatic `color` re-roll.
- `skipBake: true` — the card never touches the canvas; End skips the
  bake and the state capture.
- `deckActions: [...]` — the reducer action types this card's Overlay
  may fire through `onDeckAction`. Editor's fence is built from this
  list; undeclared actions never reach the reducer.
- `hotkeys: [{ key|code, shift?, run(ctx, e) }]` — card accents,
  dispatched ahead of the shared scopes (hotkeys.md §5.4).

## 7. Canvas-card invariants (checklist)

- **Never self-flatten.** The universal bake is Editor's; commit only
  finalizes temp objects. There is only ever one committed layer.
- **cleanup must fully undo begin** — Restart mid-card leaves nothing.
- **Control names are contracts.** `color`: seeded to a random hue each
  deal, N re-rolls it — free, by name alone. `size`: bracket keys
  resize. `mode`: E/R/S/X brush-mode keys (plus W back to arrange if the
  default mode is `arrange`). `hardness`: H toggles. Name controls
  conventionally and the whole keyboard grammar arrives unasked.
- **Whole-canvas color requires an influence slider** (the wash rule).
  Global modifiers of any other kind are banned.
- **Undo/redo is within-card, brushes only.** Report
  `{ undo, redo, canUndo, canRedo }` through `ctx.report` and
  Cmd/Ctrl+Z routes to it; nothing survives End.
- **Viewport ownership must be repaid.** A card that changes the
  viewport (Etch) restores the identity transform in commit AND cleanup
  — the bake snapshots through the current viewport.
- **Work at master resolution.** The visible canvas is a scaled proxy;
  effects that read pixels read the master (the reveal factory already
  does this). Filter-heavy work renders at 3× at bake time.
- **ML degrades gracefully** — a missing sidecar means a reduced card,
  never a blocked session.

## 8. Deck-card invariants (checklist)

Deck cards are the sharpest tier: their mechanics are reducer law, and
the reducer already carries promises that new mechanics must not break.

- **The legibility policy (v4 notes §2): set-knowledge is free;
  order-knowledge and order-control are never ambient.** They may exist
  only as dealt, spent mechanics — a card is the price.
- **Cards see the deck only through selectors.** `deckView` carries
  `remainingCounts`/`spentCards`-style outputs, never the deck array or
  raw history. If a new mechanic needs a new view, write a selector in
  `deck.js` — order-stripping and death-filtering happen there, so the
  UI cannot leak what it never receives. (`state.skim` is the one raw
  field: a paid, one-round exception, cleared on COMMIT.)
- **Actions are declared, guarded, atomic.** The card's Overlay fires
  only its registry-declared `deckActions`; every reducer case checks
  phase and current card and returns state unchanged when illegal.
- **Reinsertion is honest-random, never the bottom** — bottom placement
  is lasting order-knowledge. (Skim's bury and Delay's set-aside share
  this rule.)
- **The death shuffle preserves promises.** COMMIT's shuffle already
  special-cases Skim's kept top card. A new mechanic that makes a
  promise about order must survive that shuffle — extend the COMMIT
  case, with a comment naming the promise.
- **The Coda's position stays secret; the Coda never appears in
  REMAINS** and is never pickable (Searcher's reducer case only finds
  mods). Seeing an armed Coda is possible only as a paid exception
  (Skim), decided explicitly.
- **Every mechanic writes history events that `spentCards` can
  render.** A new event type needs a matching branch in `spentCards`
  (see `searched` → "searched", `delayed` → "set aside") or it silently
  vanishes from the piece's story.
- **Rights are granted in COMMIT, one code path.** Delay's `delayHeld`
  is set when the Delay *round ends* — so it works identically whether
  the card was dealt, searched, or skim-kept. New held rights follow this
  pattern.
- `skipBake: true` unless the card genuinely marks the canvas.

## 9. The card sheet

Fill this in before writing code. If every line has an answer, the
implementation is mechanical; the lines that resist answering are the
design work remaining.

```markdown
## Card sheet: <Label>

- **id / label**: <camelCase id> / <zyme-register name — one process word>
- **Family**: canvas | deck
- **Tier**: base | chained | rare
- **Copies**: <n — the rarity dial>
- **Primitive chain**: <which §4 entries, composed how — e.g. "Reveal × HSV">
- **The constraint**: <the one action the card permits>
- **The freedom inside**: <what the user judges/composes within it>
- **Controls**: <names — conventional names buy the keyboard grammar (§7)>
- **Randomized opening?**: <what `randomize` seeds, if anything>
- **Registry capabilities**: <Overlay? async commit? begin-awaits-user?
  skipBake? deckActions? hotkeys? — "none beyond hooks" is a fine answer>
- **New mechanics?**: <reducer cases, new selectors, new history events,
  new registry fields — anything not already in §4/§6. Each one is a
  framework extension: check it against §7/§8 and say which invariants
  it touches>
- **Copy**: <panel hint text, in tone — write it now, not in the code review>
- **Face**: assets/cards/<id>.png, 745×1040 (text face stands in until then)
```

## 10. Building and verifying

The build steps are CLAUDE.md §11; the working agreement (§2) applies —
present the card sheet, get agreement, build, then hand over browser
test steps and **wait for Stew's verification before committing**. A
card that adds deck mechanics gets its reducer cases reviewed against
§8 line by line; that checklist is the code review.
