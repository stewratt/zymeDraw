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
the card is finished — exported to the **casts folder** (§1.1), where
finished faces accumulate for curation into packs.

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
3. **Layer model — matte-on-top, sealed in two phases.** The plate is a
   *foreground matte*, not a background: a frame PNG with the image
   window punched through as real alpha. Panel art lives *underneath*
   and the plate's transparency crops it (edge detail, feathered
   corners, ornamental overhangs all come for free). The type layer
   (name / type line / description / rarity mark) floats *above* the
   plate as live, editable Fabric objects; the description sits in a
   **resizable wireframe box** you fit to each plate's text region.
   **Phase 1 (foundation):** build art-under-plate-under-type.
   **The Press** seals the whole stack into one flat raster at the
   phase boundary. **Phase 2 (graffiti):** the working deck distorts
   the sealed card on top. Spatial control is the brush's job — don't
   paint over the name and it stays pristine — so there is no per-slot
   Press. (Full z-order + rationale in §3.5.)
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

### 1.1 Adjustments (Stew, 2026-07-07) — these override §1 where they conflict

- **Export — casts folder, not direct-to-Deck (amends #4).** Foundry is
  a generative space: many casts, then a curated set. The Proof writes
  the 745×1040 face + full-res master to a per-machine **casts folder**
  (config key in `~/.deck-config.json`; never `assets/cards/` directly).
  Stew curates packs by hand and drops them into
  `frontend/src/assets/cards/` file-for-file. Direct-to-Deck export
  moves to the §6 Phase-7 backlog — revisit if/when casts are reliably
  good enough to swap on the fly.
- **Plates — Stew's 8 templates exist (amends #6).** `card_template/`
  at repo root holds 8 blank plates, exactly 2235×3120 (3× master) RGBA
  with the image window punched as real alpha; name/type plaques and
  text box are opaque graphics. Untracked (repo-wide `*.png` ignore) —
  local-only as planned; `platesFolder` defaults to the repo's
  `card_template/`. Text working areas are uniform across plates, but
  corner-box shapes vary — type slots stay nudgeable (§4) to fit them.
  The procedural plate generator is **deferred to the Phase-7 backlog**;
  8 real plates are enough of a deck to start.
- **Fonts — style-paired trios, dealt per session (amends #5).**
  `card_template/fonts/{title,body}/{mtg,pk,jp}/` holds Google-Fonts
  zips (all OFL, licenses inside): title mtg=Cinzel, pk=Cabin,
  jp=M PLUS Rounded 1c; body mtg=EB Garamond, pk=Jost+Hind, jp=Kosugi.
  One of the three **styles** (mtg / pk / jp) is dealt at session start;
  the name/type slots set in the style's title font, the description in
  its body font — matched pairings, not per-slot draws from one big
  deck. Re-roll (N) re-deals the style. At Phase 4 the zips are
  unzipped into `frontend/src/assets/fonts/<style>/` and committed
  (no OS install — the browser loads `.ttf` via `FontFace`).
  **Proprietary faces (added 2026-07-07):** Beleren + MPlantin (the
  real MTG fonts, Wizards-proprietary) sit as loose `.ttf`s in the mtg
  folders. They are **never committed** — `card_template/` is
  gitignored wholesale — so `fonts.js` treats them as a *local
  overlay*: served per-machine by the backend alongside the committed
  OFL set, dealt when present, absent without error on machines that
  lack them (the card-art-placeholder pattern).

---

## 2. The Foundry session arc (design draft — iterate at checkpoints)

Shorter and tighter than a Deck session; a card face is a small piece.

```
── PHASE 1 · THE FOUNDATION (live, editable, alpha-composited) ──
COMMISSION    choose the card id being cast (MOD_CARDS + coda).
              Prefills the name (label), the type line (family:
              image / deck / coda), the rarity tier (copies).
PLATE_DEAL    deal 3 plates — a mix of folder plates and procedural
              plates — take one. The plate is a MATTE ON TOP: a frame
              with the image window punched through as alpha.
PANEL_PICK    grid pick (exports + inputs) for the image; place/scale
              it UNDERNEATH the plate — the plate's alpha window crops
              it. Mask brush available. Live, not yet sealed.
TYPE_SETTING  the type layer arrives ABOVE the plate, one dealt font
              per slot (re-rollable, like Deck's N-key hue). Enter/edit
              the text; nudge/size within each slot's home; the
              description sits in a resizable wireframe box fit to the
              plate's text region. Live objects, not yet pixels.
── THE PRESS · seal the foundation (one commit, irreversible) ──
              Flatten art + plate + type into a single raster. No more
              alpha window, no more live text — a complete card face.
── PHASE 2 · GRAFFITI (distort the sealed card) ──
WORKING       the foundry deck deals graffiti rounds — Silt, Bruise,
              Char... — each End-committed through the universal bake,
              riding on top of the whole sealed card. Paint where you
              want the harm; skip the name to keep it clean.
PROOF         after TUNING.workingRounds, Proofs shuffle into the
              remaining deck; dealing one finishes the card.
              Export: casts folder (§1.1) — face at 745×1040 + master.
```

Foundry tuning numbers live in `foundryDeck.js` (`FOUNDRY_TUNING` +
`FOUNDRY_CARDS`), same one-place rule as Deck. Draft: `plateDeal: 3`,
`workingRounds: 3`, `proofCount: 2`.

**The Press tension** is the heart of the design, but it is one seal at
the phase boundary, not a per-slot choice. Before the Press the whole
foundation is live — re-pick art, re-word the description, re-deal
fonts, nudge everything — and graffiti can't touch it. The Press
commits the entire card face to pixels at once (the same commitment
mechanic as End, aimed at the foundation as a whole); after it, the
card is fair game for the graffiti deck. The judgment call is *how far
you let the distortion eat a card you've fully composed* — and because
every graffiti tool is a brush, sparing the name is just not painting
there. (Why this replaces the old per-slot Press: §3.5.)

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
  rarity mark) as Fabric objects *above the plate matte* (§3.5): the
  name/type/rarity anchors, the description's resizable wireframe box,
  font assignment, and the foundation-seal (the Press).
- `fonts.js` — manifest over `src/assets/fonts/` (`import.meta.glob`),
  `FontFace` loading (fonts must be loaded before Fabric renders
  text), and the font deal.
- `plates.js` — the plate deck as *alpha mattes* (§3.5): folder plates
  (PNGs with the image window punched through) fetched from the backend
  + the procedural generator drawing the frame around a transparent
  window (parameterized: border width/inset, window geometry/shape,
  text-box treatment, corner style, palette; seeded per deal).
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
- `POST /api/foundry/export` — writes the 745×1040 face and the
  full-res master to the casts folder (§1.1), filenames carrying the
  commission id + a timestamp so iterations never overwrite.

---

## 3.5. The layer stack (matte-on-top, two-phase seal)

The single most load-bearing decision after "sibling app." Read it
before touching plates, panel placement, or the bake.

**The plate is a foreground matte, not a background.** A blank plate is
a PNG frame with the image window punched through as *real alpha*
(transparent pixels). The panel art lives underneath; the plate's own
transparency crops it. This is why plate dimensions don't have to be
perfectly consistent — the alpha window *is* the mask, so whatever edge
detail a plate carries (rounded window corners, feathered edges,
ornamental lips overhanging the art) crops the art for free, and the
app never needs a strict clip rectangle or per-plate panel coordinates.

**Phase-1 z-order, bottom to top (all live, composited every frame):**

```
   type layer     name · type line · description (resizable box) · rarity
   plate matte    frame art + alpha-punched image window
   panel art      the dealt image, placed/scaled under the window
   ─────────────  (white master beneath, as ever)
```

Fabric composites this natively: three stacked objects with per-object
alpha, `toCanvasElement` at master scale resolves the window correctly
— no custom compositing code.

**The Press seals Phase 1 into one flat raster.** At the phase boundary
the whole stack flattens through the universal bake: the alpha window
resolves (art shows through, baked in), the live text becomes pixels,
and what remains is a single complete card face. Irreversible, like
every End.

**Phase 2 is graffiti on the sealed card.** The working deck (Silt,
Bruise, Char…) rides on top of the flat face. There is **no per-slot
Press** and no "graffiti goes under the type" mode, because every
graffiti tool is a *brush* — spatial control is already yours. Want the
name pristine? Don't paint over it. Want the whole card devoured
(the evilbiscuit end)? Paint through everything. The design tension
moved from *when do I expose the type* to *how far do I let the
distortion go* — a better fit for the north star, and less machinery.

**Two dimensional-inconsistency workarounds, one per problem area:**
- *Image box varies between plates* → the alpha window absorbs it; art
  is placed generously under the hole and cropped to whatever shape.
- *Text box varies between plates* → the description is a **resizable
  wireframe box** (Fabric's native Textbox handles) you fit to each
  plate's text region per session. Micro-adjust until the copy sits.

**Plate-authoring spec** (for the blank PNGs Stew makes — see also the
`foundry_card_template.png` guide at repo root):
- 745×1040, or draw at 3× (2235×3120) for crisp edges; app downscales.
- PNG with **real alpha**. The image window must be *transparent
  pixels* (alpha 0), never a white/colored fill. Feathered /
  semi-transparent edges are encouraged — they blend the art.
- Frame, borders, text-panel graphics: opaque (or whatever you design).
- Keep the name / type / text-box regions relatively clear — live type
  sits on top of them.
- **No baked-in placeholder text** — name/type/description come from
  the type layer.
- Align the transparent window roughly with the template's panel guide,
  but the exact window shape is yours; the crop follows your alpha, not
  the guide rectangle.

---

## 4. The type system (the genuinely new machinery)

Deck has no text. Foundry's type layer is the one subsystem with no
existing organ to borrow, so its rules are spelled out here:

- **Four slots, conventional homes, above the plate.** Name
  (upper-left), type line (upper-right), description (bottom-center
  textbox, wrapping), rarity mark (bottom corner) — all rendered
  *on top of* the plate matte (§3.5). Name/type/rarity have an anchor
  region and size range, not a fixed box; the **description is a
  resizable wireframe box** (Fabric Textbox handles) fit to each
  plate's text region per session, since plates disagree on where the
  text panel sits. Nudging within the convention is free; the
  convention is only broken by graffiti after the Press.
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
- **Press** seals the whole foundation — art + plate + type together —
  into the master via the universal bake, then removes the live objects
  (§3.5). One commit at the Phase-1/Phase-2 boundary, not per-slot and
  not per-object; irreversible, like every bake. There is no "unpressed
  type at Proof" case: the Press *is* the transition into graffiti, so
  by the time Proofs deal, the type is already pixels.
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
  PLATE_DEAL → PANEL_PICK → TYPE_SETTING → PRESS → WORKING → PROOF) but
  stub content: commission is a simple list from `MOD_CARDS` + Coda,
  plates are flat-color stubs, panel/type phases are pass-through, the
  Press is a no-op bake, working rounds deal from a two-card stub deck,
  Proof exports a plain PNG through the existing `/api/export`.
- `FoundryEditor.jsx` + `FoundryPanel.jsx` dispatching through
  `foundryRegistry.jsx` — the registry contract from day one.
- **Verify:** click through a whole hollow session; deal/End rhythm,
  restart, and the Proof export all work.

### Phase 2 — Plates (the alpha matte)
- Backend: `platesFolder` config + `/api/plates` routes; defaults to
  the repo's `card_template/` (§1.1), Setup-style folder pick to
  override (persisted to `~/.deck-config.json`).
- `plates.js`: folder plates only (§1.1 — the procedural generator is
  Phase-7 backlog); PLATE_DEAL becomes a real 3-up grid pick from the
  8 templates.
- The plate mounts as a *matte on top* (§3.5), not the background —
  render it above the (still empty) panel layer so the alpha window
  shows through.
- **Verify:** deal plates, take one, its window is transparent (the
  white master shows through the hole); re-deal gives a different mix.

### Phase 3 — The panel (art under the matte)
- Extend sampling to the output folder; PANEL_PICK grid (exports +
  inputs), art placed/scaled *underneath* the plate matte — the
  plate's alpha window crops it, no explicit clip rectangle. Mask brush
  available. Live, not yet sealed.
- **Verify:** pick a finished Deck piece as panel art, drag/scale it
  under the window, watch the plate's edge detail crop it cleanly.

### Phase 4 — Type + the Press (seal the foundation)
- Unzip the style trios into `frontend/src/assets/fonts/<style>/`
  (OFL licenses committed alongside) + `fonts.js` manifest, `FontFace`
  loading, and the per-session style deal (§1.1: mtg / pk / jp).
- `typeLayer.js`: the four slots *above the plate*, the dealt style's
  title/body pairing, re-roll accent (re-deals the style), text entry
  (prefilled name/type from the commission), the description's
  **resizable wireframe box** fit to the plate's text region,
  nudge/size within slot conventions; keymap suppressed during
  text editing.
- **The Press**: one commit that seals art + plate + type into the
  master via the universal bake, removes the live objects, and crosses
  into WORKING. Not per-slot (§3.5).
- **Verify:** place art, set the type, re-roll fonts, resize the
  description box to fit, Press — the whole face (window resolved,
  lettering included) is now flat pixels.

### Phase 5 — Graffiti, wave 1
- Foundry registry entries for the brush-core cards — Silt, Bruise,
  Dissolve, Steep, Turn, Cure, Char, Rails — pointing at the shared
  behavior files in `editor/cards/`; fix any ctx-shape gaps in
  FoundryEditor rather than forking card files.
- The WORKING deck becomes real: draft one copy each, `FOUNDRY_CARDS`
  in `foundryDeck.js`.
- **Verify:** two or three full sessions; after the Press, graffiti
  rides on the sealed face — paint through the lettering to eat it, or
  spare the name to keep it clean.

### Phase 6 — The Proof: into the casts folder
- `rarity.js` tier + mark rendered into the foundation at TYPE_SETTING;
  `POST /api/foundry/export` writing face + master to the casts folder
  (§1.1; the face is already flat — sealed at the Press).
- **Verify:** cast a face for a real card id, find both files in the
  casts folder; copy the face into `assets/cards/<id>.png` by hand,
  reload Deck, the face is live on the dealt card.

### Phase 7 — Later (unordered, post-verification backlog)
- Graft cards + Deeper in the foundry deck (sampling + sidecar).
- The procedural plate generator (deferred from Phase 2 — §1.1); then
  v2 families, texture, wear.
- Direct-to-Deck export (deferred — §1.1): Proof writes
  `assets/cards/<id>.png` live, once casts are reliably keepable.
- Recast (re-deal fonts as a dealt card), a forcing Press card (§7).
- User font folder joining the font deck; print-resolution export
  with bleed; a Foundry state cache/plinth if wanted.

---

## 7. Open questions (decide at checkpoints, not unilaterally)

- **Commission: chosen or dealt?** Current draft: chosen (you came to
  cast a specific face). A "deal me a commission" option is cheap and
  very Foundry — decide when the COMMISSION screen is real (Phase 1).
- ~~Press: whole layer or per-slot?~~ **Resolved (§3.5):** one seal of
  the whole foundation at the Phase-1/Phase-2 boundary. Spatial control
  over what graffiti eats is the brush's job, not a per-slot mode.
- **Does the Press stay a manual boundary, or can a dealt card force
  it?** Current design: you choose when to seal. A dealt "seal now"
  card is pure Foundry chaos, but the deliberate seal is probably the
  better judgment beat. Revisit once graffiti (Phase 5) has a feel.
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
