# card_maker.md — Foundry: the card maker (design + build plan)

> The plan for **Foundry**, the second application in this repo: a
> deck-driven tool for designing the Deck's own card faces. Read this
> whole file before building; §6 is the phased build plan and the
> checkpoint map. Decisions already made with Stew are recorded in §1 —
> don't re-litigate them; open questions live in §7.

---

## 0. What Foundry is

Foundry makes the 745×1040 card faces that `cardArt.js` serves to
`Card.jsx`. It is **a sibling application, not a feature of Deck** — its
own entry point, its own session arc, its own deck — but it is built
from Deck's organs: the master raster, the brush core, the registry
contract, the pure-reducer state machine, the grid pick.

**Making a card IS a Deck session.** Foundry deals you materials
(a plate, fonts), you set the conventions (name, type line, image
panel, text box), and then a small deck of graffiti cards works the
face over, End by End, destructively, until a **Proof** is dealt and
the card is finished — exported straight into
`frontend/src/assets/cards/<id>.png`, live in Deck on next reload.

**The north star for chaos** is the evilbiscuit *card nft 2*
(tensor.trade/trade/card_nft_2): a card whose TCG anatomy is present
but half-devoured — lettering smeared, frame bruised, panel bleeding.
Foundry's job is to put the conventions in place *first* (standard TCG
layout: name upper-left, type upper-right, image panel center, text
box bottom-center, rarity mark) so that the session can then **break
them on purpose**. Legibility is a starting condition, not a
requirement of the result.

**Tone: Foundry is a print shop.** Same macro invariant as Deck
(CLAUDE.md §1) — studio/darkroom/press language, never arcade. The
vocabulary is the type foundry's: *plate, type, set, press, proof,
cast, commission*. All Foundry copy obeys the zyme register.

---

## 1. Decisions locked (Q&A with Stew, 2026-07-06)

1. **Architecture — sibling app, same repo.** A second Vite entry
   (`frontend/foundry.html` → `src/foundry/`) in the existing frontend
   package. One `npm run dev` serves both apps; shared modules under
   `src/editor/` are imported directly, never copied.
2. **Randomness — full deck-driven meta-session.** Foundry has its own
   pure-reducer deck (`foundryDeck.js`, mirror of `deck.js`): materials
   are dealt, working rounds are dealt, End commits destructively, a
   Proof ends the session. The tool eats its own philosophy.
3. **Layer model — structured until baked.** The type layer (name /
   type line / description / rarity mark) starts as live, editable
   Fabric text objects floating above the raster. A standing **Press**
   action bakes the type into the pixels at any point — after Press,
   graffiti cards smear straight through the lettering. Until Press,
   graffiti works the raster *under* the type.
4. **Export — direct to the Deck.** A session opens on a
   **commission**: which real card id (from `MOD_CARDS` + Coda) this
   face is for. The Proof writes `frontend/src/assets/cards/<id>.png`
   at 745×1040 plus a full-resolution master copy to the output folder.
5. **Fonts — bundled curated set.** ~15–30 OFL-licensed fonts committed
   to the repo (serif, slab, blackletter, mono, display/grunge).
   Identical on all three machines, works offline, and the font deal
   draws from a known deck.
6. **Plates — Stew's PNGs + procedural.** A per-machine baseplates
   folder (blank TCG-style frames Stew makes/sources; local-only, never
   committed — same trademark caution as card art) PLUS a procedural
   plate generator drawing original frames from layout parameters. Both
   feed one plate deck.
7. **Rarity — read from `deck.js`.** Derived from the commission's real
   copy count (2 copies = common, 1 = scarce, Coda = its own class),
   rendered as a small mark. True to how often the card is dealt.
8. **Graffiti scope, first build — brush-core cards.** Silt, Bruise,
   Dissolve, Steep, Turn, Cure, Char, Rails: everything that needs only
   the raster + brush engine. Graft cards (Ghost/Stain/Stamp) and
   Deeper come later — they drag in image sampling and the sidecar.
9. **Panel art — Deck exports + input folders.** The image-panel pick
   grid samples from both the finished-pieces output folder and the raw
   input folders. The deck's own output feeds the deck's faces.
10. **Name — Foundry.** A type foundry casts the type; this casts the
    deck's faces.

---

## 2. The Foundry session arc (design draft — iterate at checkpoints)

Shorter and tighter than a Deck session; a card face is a small piece.

```
COMMISSION    choose the card id being cast (MOD_CARDS + coda).
              Prefills the name (label), the type line (family:
              image / deck / coda), the rarity tier (copies).
PLATE_DEAL    deal 3 plates — a mix of folder plates and procedural
              plates — take one. It becomes the base raster.
TYPE_SETTING  the type layer arrives, one dealt font per slot
              (re-rollable, like Deck's N-key hue). Enter/edit the
              text; nudge position and size within the slot's
              conventional home. Live objects, not yet pixels.
PANEL_PICK    grid pick (exports + inputs) for the center image
              panel; place/scale within the panel bounds, mask brush
              available. End bakes the panel in.
WORKING       the foundry deck deals graffiti rounds — Silt, Bruise,
              Char... — each one End-committed through the universal
              bake. PRESS is a standing action throughout: bake the
              type into the raster, opening the lettering to harm.
PROOF         after TUNING.workingRounds, Proofs shuffle into the
              remaining deck; dealing one finishes the card. Any
              still-live type composites into the final render.
              Export: assets/cards/<id>.png (745×1040) + master copy.
```

Foundry tuning numbers live in `foundryDeck.js` (`FOUNDRY_TUNING` +
`FOUNDRY_CARDS`), same one-place rule as Deck. Draft: `plateDeal: 3`,
`workingRounds: 3`, `proofCount: 2`.

**The Press tension** is the heart of the design: unpressed type stays
crisp and editable but the graffiti can never touch it; pressed type
joins the pixels and can be destroyed. When you press is the session's
big judgment call — the same commitment mechanic as End, aimed at
legibility itself.

**Canvas geometry.** Working canvas 745×1040 (the exact face size —
what you see is the deliverable), master at 3× = **2235×3120**. Same
proxy-and-master pattern as Deck, different dimensions — which is why
`masterRaster.js` gets parameterized (Phase 0).

---

## 3. What's reused, what's parameterized, what's new

**Shared verbatim (import from `src/editor/`):**
- `brushCore.js` — the stroke engine, untouched.
- `Card.jsx` + `cardArt.js` — Foundry's own deal UI renders through the
  same component (a dealt Silt looks like a dealt Silt).
- `GridPicker.jsx`, `sampling.js` — the plate deal and panel pick.
- `keymap.js` patterns, `CardZoom.jsx`, deal/End panel rhythm.
- **The registry contract itself** (`card_anatomy.md`): Foundry's
  editor provides the same ctx shape (`controls`, `session`, `canvas`,
  `info`…) so the brush-core card behavior files in `editor/cards/`
  are shared **without modification**. This is the load-bearing reuse
  decision — if a card file needs a Foundry fork, first ask whether
  the ctx shape is being honored.

**Parameterized (small refactors, Deck behavior unchanged):**
- `masterRaster.js` — today it imports `CANVAS_WIDTH/HEIGHT` from
  `CanvasStage.jsx` and derives 2400×3000. Refactor: the functions
  take explicit dimensions/scale (or a raster-config object); Deck's
  call sites pass its constants, Foundry passes 745×1040×3.
- `CanvasStage.jsx` — accepts width/height props, defaulting to Deck's.

**New, under `frontend/src/foundry/`:**
- `main.jsx` + `foundry.html` — the second Vite entry.
- `FoundryApp.jsx` / `FoundryEditor.jsx` / `FoundryPanel.jsx` — the
  shell, the registry dispatcher, the right sidebar. Same
  no-per-card-branches law as Deck's Editor.
- `foundryDeck.js` — the pure reducer. No Fabric, no DOM; the complete
  Foundry rulebook in one readable file.
- `foundryRegistry.jsx` — maps foundry card ids to hooks; brush-core
  entries point at the shared behavior files; foundry-native cards
  (Proof) get their own files here.
- `typeLayer.js` — the four slots (name, type line, description,
  rarity mark) as Fabric Textbox/objects: slot conventions (anchor
  positions, size ranges), font assignment, and the Press bake.
- `fonts.js` — manifest over `src/assets/fonts/` (`import.meta.glob`),
  `FontFace` loading (fonts must be loaded before Fabric renders
  text), and the font deal.
- `plates.js` — the plate deck: folder plates fetched from the
  backend + the procedural generator (parameterized frame: border
  width/inset, panel geometry, text-box treatment, corner style,
  palette; seeded per deal).
- `rarity.js` — imports `MOD_CARDS`/`DEATH_CARD` from
  `editor/deck.js`, derives the tier and the mark.

**Backend additions (`server.js`, same patterns as existing routes —
tilde expansion, basename+startsWith traversal safety, re-validate
folders per request):**
- Config keys in `~/.deck-config.json`: `platesFolder`.
- `GET /api/plates` + `GET /api/plates/:filename` — list/serve the
  baseplate PNGs.
- Panel-pick sampling from the output folder as well as inputs
  (extend `/api/images/sample` with a source param, or a sibling
  route — keep it registered before any `/:filename` route).
- `POST /api/foundry/export` — writes the 745×1040 face to
  `frontend/src/assets/cards/<id>.png` (repo-relative path, resolved
  from the server's location, never hardcoded per machine) and the
  full-res master to the output folder.

---

## 4. The type system (the genuinely new machinery)

Deck has no text. Foundry's type layer is the one subsystem with no
existing organ to borrow, so its rules are spelled out here:

- **Four slots, conventional homes.** Name (upper-left), type line
  (upper-right), description (bottom-center textbox, wrapping), rarity
  mark (bottom corner). Each slot has an anchor region and a size
  range, not a fixed box — nudging within the convention is free;
  the convention itself is only broken by graffiti after Press.
- **Fonts are dealt.** Each slot draws a font from the bundled deck at
  TYPE_SETTING; a re-roll accent (N, matching Deck's hue re-roll) is
  free per slot until Press. The description slot biases toward the
  readable end of the font deck; the name slot is allowed the wild end.
- **Content:** name and type line prefill from the commission
  (`label` + family from `deck.js`); the description is free entry —
  Stew writes the card's text in the tool. Editing is plain Fabric
  Textbox editing; keymap suppression while a text object is in
  editing mode (the existing form-control rule extends to Fabric's
  text editing state).
- **Press** bakes the whole type layer (or per-slot? — open question
  §7) into the master via the universal bake, then removes the live
  objects. Irreversible, like every bake. Unpressed type at Proof time
  composites into the export — a card can end pristine.
- **Loading discipline:** every font in the manifest is registered via
  `FontFace`/`document.fonts` and awaited before any Fabric text
  renders in that font — unloaded fonts silently render as serif and
  would bake wrong.

---

## 5. Rarity

Tier derives from the commission's real deck presence: **2 copies =
common, 1 copy = scarce, Coda = singular** (names draft — zyme
register, not TCG jargon). The mark is small and materially rendered
(a punch, a stamp, a foil-ish blot — procedural, per-plate palette),
never a star-rating UI. If a card's copies change in `deck.js`, the
face doesn't retroactively lie: rarity is stamped at casting time,
like a print run.

---

## 6. Build plan — phases, chunked for handoff

Each phase is one working session: build, summarize, explain the one
key concept, **stop and wait for Stew's browser verification** (the §2
working agreement is in force — no phase begins before the previous
one is verified). Every phase ends with explicit test steps.

### Phase 0 — The second press: scaffold + card-format raster
- Add `frontend/foundry.html` + `src/foundry/main.jsx` +
  `FoundryApp.jsx` shell; register the extra input in
  `vite.config.js` `build.rollupOptions.input` (dev serves it with no
  config; only build needs the entry).
- Parameterize `masterRaster.js` + `CanvasStage.jsx` dimensions; Deck
  call sites updated, Deck behavior identical.
- Foundry mounts a 745×1040 working canvas with a 2235×3120 master;
  prove the universal bake at the new dimensions with a throwaway
  scribble→End.
- **Verify:** `npm run dev`, open `localhost:5173/foundry.html`, see
  the card-format canvas; scribble, End, confirm the bake; open Deck
  at `/` and confirm nothing changed.

### Phase 1 — The hollow session: foundryDeck.js end to end
- `foundryDeck.js` pure reducer with the full arc (COMMISSION →
  PLATE_DEAL → TYPE_SETTING → PANEL_PICK → WORKING → PROOF) but stub
  content: commission is a simple list from `MOD_CARDS` + Coda,
  plates are flat-color stubs, type/panel phases are pass-through,
  working rounds deal from a two-card stub deck, Proof exports a
  plain PNG through the existing `/api/export`.
- `FoundryEditor.jsx` + `FoundryPanel.jsx` dispatching through
  `foundryRegistry.jsx` — the registry contract from day one.
- **Verify:** click through a whole hollow session; deal/End rhythm,
  restart, and the Proof export all work.

### Phase 2 — Plates
- Backend: `platesFolder` config + `/api/plates` routes; Setup-style
  folder pick in Foundry (persisted to `~/.deck-config.json`).
- `plates.js`: procedural generator v1 (border, panel geometry,
  text-box treatment, corner style, palette — parameterized and
  seeded per deal) + folder plates; PLATE_DEAL becomes a real 3-up
  grid pick mixing both sources.
- **Verify:** deal plates, see folder + generated mixed, take one,
  it's the base raster; re-deal gives different generated plates.

### Phase 3 — Type
- Bundle the first ~12 fonts (OFL; licenses committed alongside) +
  `fonts.js` manifest and loading.
- `typeLayer.js`: the four slots, dealt fonts, re-roll accent, text
  entry (prefilled name/type from the commission), nudge/size within
  slot conventions; keymap suppressed during text editing.
- **Press** as a standing action: bake the type, remove the live
  objects, disable further type editing.
- **Verify:** set a card's type, re-roll fonts, edit the description,
  Press, export — the lettering is in the pixels.

### Phase 4 — The panel
- Extend sampling to the output folder; PANEL_PICK grid (exports +
  inputs), placement clipped to the plate's panel region, mask brush
  available, End bakes.
- **Verify:** pick a finished Deck piece as panel art, mask its edge
  into the frame, End.

### Phase 5 — Graffiti, wave 1
- Foundry registry entries for the brush-core cards — Silt, Bruise,
  Dissolve, Steep, Turn, Cure, Char, Rails — pointing at the shared
  behavior files in `editor/cards/`; fix any ctx-shape gaps in
  FoundryEditor rather than forking card files.
- The WORKING deck becomes real: draft one copy each, `FOUNDRY_CARDS`
  in `foundryDeck.js`.
- **Verify:** two or three full sessions; graffiti under live type,
  then Press mid-session and graffiti through the lettering.

### Phase 6 — The Proof: direct to the Deck
- `rarity.js` tier + mark rendered at TYPE_SETTING; `POST
  /api/foundry/export` writing `assets/cards/<id>.png` + the master
  copy; unpressed type composited at export.
- **Verify:** cast a face for a real card id, reload Deck, the face
  is live on the dealt card. The loop closes.

### Phase 7 — Later (unordered, post-verification backlog)
- Graft cards + Deeper in the foundry deck (sampling + sidecar).
- Procedural plates v2 (more families, texture, wear).
- Recast (re-deal fonts as a dealt card), a forcing Press card (§7).
- User font folder joining the font deck; print-resolution export
  with bleed; a Foundry state cache/plinth if wanted.

---

## 7. Open questions (decide at checkpoints, not unilaterally)

- **Commission: chosen or dealt?** Current draft: chosen (you came to
  cast a specific face). A "deal me a commission" option is cheap and
  very Foundry — decide when the COMMISSION screen is real (Phase 1).
- **Press: whole layer or per-slot?** Whole-layer is one clean
  commitment; per-slot lets the name stay live while the description
  gets eaten. Decide in Phase 3 with the tool in hand.
- **Does a forcing Press belong in the deck?** A dealt card that
  presses the type whether you're ready or not — pure Foundry chaos,
  but maybe the standing action's judgment is the better design.
- **Description text source:** free entry only, or a committed
  `cardText.js` data file so the canonical card text lives in code
  and prefills? (Leaning data file once texts stabilize.)
- **How chaotic may procedural plates get** before they stop reading
  as plates at all? (evilbiscuit says: very. But the plate is the
  convention layer — maybe the plates stay straight and the session
  supplies the chaos.)
- **Rarity tier names** — zyme-register words for common/scarce/
  singular, settled when the mark is designed.

---

## 8. Invariants carried over from Deck (in force in Foundry)

- Destructive, commitment-based; within-card brush undo only; the
  two-press rhythm (End, then Deal); no auto-deal.
- Constraint outside, freedom inside — no Foundry card may simply *do
  something* to the face with no room for judgment.
- Pure reducer holds ids and filenames, never images; all tuning in
  one place; no per-card branches in FoundryEditor/FoundryPanel.
- Frontend = brain, backend = hands; never hardcode per-machine paths.
- 2d `ctx.filter` Safari caveat, 3× bake texture-cap caution, and the
  filter-flush-before-snapshot rule all apply at 2235×3120 too.
- Studio register everywhere; "death card" was never UI copy in Deck
  and "win/unlock/loot" will never be UI copy in Foundry.
