# CLAUDE.md — Deck (zymeDraw)

> Persistent context for any Claude Code session. Read it top-to-bottom
> before doing any work; keep §0 updated as work lands — it's the resume
> point. This file records what is *true now* and *how we work*; history
> lives in git and the design docs, never here.

---

## 0. Current state — resume here (updated 2026-07-09)

**Version numbers are retired.** Work is now organized as two named
**lines** — pickable in any order, no dependency between them, only the
shared repo:

**The itemized backlog lives in GitHub issues (2026-07-09).** The plan
docs in `to_do/` hold the design rationale; the work units are issues on
`stewratt/zymeDraw`, labeled by line (`card-line` / `infra` / `foundry`)
and size. The workflow: pick an issue → branch off `main` (per issue, not
per line) → build in checkpoints, Stew verifies in the browser on the
branch → PR with "Closes #N" → merge. `size:S` items skip the ceremony
(direct commit to `main` with "Closes #N"). Parent issues (the merge #5,
design language #10, Electron #11, deck builder #16) are checklists whose
children get their own issues when picked up. `parked` issues (#18–#31,
the designed-but-uncommitted ideas from the archive docs + Foundry
phase 7) never get a branch until deliberately promoted. Browse:
`gh issue list` / by label `gh issue list -l card-line`.

**The card line — read `to_do/cards_plan.md`.** Theme: the Kid Pix wave — four
new card designs (Closer, the lift brush, the stamp brush, the fracture
exemplar) and, once the pool outgrows the deck, a deck-builder menu with a
size cap + archetypes (decision locked in its §6; nothing built yet). Its
§7 waves are the card line's checkpoint map; §8 lists the names/choices
Stew still owes before each wave opens. The old line-branch convention
(`v5` as the card line's standing branch) is retired in favor of the
per-issue branches above; `v5` remains only as history.

**The deck editor (card line Wave 5, issue #16) — built 2026-07-10 on
branch `claude/deck-editor-16`, awaiting Stew's browser verification.**
Built ahead of the remaining Kid Pix cards (Stew's call: the room exists
*before* the pool bloats, reversing the plan's original ordering). A room
off the setup screen — plainly named **Deck editor** per the new §1
legibility clause — where the next session's deck is assembled from the
pool (= all active `MOD_CARDS` designs) under a cap. Rules (cap 20 /
floor 12 / max 3 copies per design) live in `DeckEditor.jsx`, NOT
`deck.js`: the reducer never learns about the room; its entire output is
a `[{ id, copies }]` spec handed to `initialState(deckSpec)` (rides
`state.deckSpec` so Restart rebuilds the same deck; null = house deck;
unknown ids are dropped in `resolveSpec`, empty falls back to house).
Saved decks persist per machine in `~/.deck-config.json` (`decks` key,
whole-list replace via `POST /api/decks`). Starting points: House deck
only until the pool grows (archetypes are one-line data entries). The
20-card cap held (Stew, 2026-07-10: "just because 22 cards exist doesn't
mean it needs to be that size") and the house deck was thinned to fit it
exactly: Ghost 2→1, Stain 2→1, Blur 1→2. OPEN at the Lift merge (#33):
Lift's `MOD_CARDS` line takes the house deck to 21 — either one more
cut lands with it or Lift enters pool-only; decide there.

**`main` holds the complete v1 → v4 tool, verified by Stew** — v4 merged
(fast-forward) 2026-07-07. The version story lives in the design docs
(v1–v4 now under `archive/`): `archive/design_changes_july2.md` (v1
lessons), `archive/redesign_v2_plan.md` (v2: master raster + bake, brush
core, ML sidecar), `archive/version_3_design.md` (v3: card
system, zyme register, mask brush), `archive/v4_design.md` +
`archive/v4_design_notes.md` (v4: the legible deck — card standard, deck
overlay, plinth, Foundry).

**The infrastructure line — read `to_do/app_plan.md`** (written 2026-07-07,
the day of the merge). Theme: glue — the app is renamed **ZYME**, Foundry
merges into one application shell, packaging (Electron, eventually) and
the image-server stream get real plans, and the codebase gets
overhaul-ready for the design-language project. Its §7 waves are the
checkpoint map for infrastructure work; §8 lists the questions Stew still
owes answers on before each wave opens. Nothing in it is built yet.

**Card-design work continues in parallel — read `to_do/cards_plan.md`**
(the card line: the Kid Pix cards + the deck builder). Its §0 also carries
the still-live backlog inherited from the now-archived v4 docs — the
descent experiment, mid-state pulling (§9.3), death-crop (§6.5), and the v3
threads suits/Echo/Mount. The v4 spec + notes are the reference:
`archive/v4_design.md` + `archive/v4_design_notes.md`.

**Per-copy card face variants (landed + verified 2026-07-07).** A card
dealt in N copies may carry N distinct faces: copy 1 = `<id>.png`, copy 2
= `<id>.2.png`, … (generalizes to 3x+). Opt-in — `cardArtSources`
(`editor/cardArt.js`) tries the variant face first and falls back to the
bare `<id>.png` within each source tier, so a set shipping one design has
every copy borrow it. `deck.js`'s `buildDeck` tags each copy with a
1-based `variant` that rides the shuffle; only the *dealt* card renders
it (the deck overlay stays base-face). Foundry casts a run as `_i1/_i2`
impressions; curate them into a set as `<id>.png` + `<id>.2.png`. Doc:
`card_anatomy.md` §5 home #4. First curated set (`foundry-v1`, Stew's
Foundry designs) verified in the browser.

**Session 2026-07-07 (checkpoint `8a7711f` then a rename commit):** two
things landed. (1) **Card face sets** — card art now reads from a
per-machine `cardsetsFolder` (Setup picker + live set switcher), served
by `/api/cards`; `editor/cardArt.js` holds the set store + a fallback
chain (active set → bundled `assets/cards/` → text face), so the
committed art is the built-in default set and external sets are an
override. Faces are keyed by **id** (`ghost.png`), one subfolder per set.
(2) **Card id rename** (`dissolve→blur`, `silt→dust`, `turn→hue`,
`cull→searcher`) — Stew's renamed cards now match their ids end to end.
The convention is now in `card_anatomy.md` §5 item 0: id = name slugified
at creation; re-slugging is a deliberate refactor commit, never a
copy-editor edit. **Note the register tension** (§1 tone): Blur/Hue read
as settings-menu labels, which the zyme register warns against — the
register-exemplar lists were trimmed to surviving cards, not extended
with the new names; revisit if the register still matters for these.

**The deck today: 20 mod cards + 3 Coda** (`MOD_CARDS` in `deck.js`).
Rack + the two style-transfer cards are retired/stashed — files and
registry entries stay, deck lines commented out. Style-transfer works end
to end but the demo ONNX styles aren't shippable; when Stew trains his
own, re-add the two `MOD_CARDS` lines and swap the model.

**Shipped and verified on the branch** (details in git log + v4 docs):
the standardized card visual (`Card.jsx` 745×1040 + `cardArt.js`; current
art is local-only gitignored placeholders — real faces drop in
file-for-file, then need `!frontend/src/assets/cards/*.png` to commit),
the deck overlay (SPENT in sequence / REMAINS unordered ×N) + card zoom +
canvas-filling grids, the plinth (the piece as an orbitable three.js
panel at the Coda; `Plinth.jsx`, lazy-loaded), and the state cache (every
bake keeps a captioned full-res JPEG in memory; **C** leafs the plinth
face through the states; Restart clears it; capture-and-view only).

**Awaiting Stew's browser verification: Cull + Skim (Wave 2, built
2026-07-06)**, one copy each. Cull: remains face up, take one
(`PICK_FROM_DECK`). Skim: turn the top card — sees everything, armed Coda
included (the paid exception) — keep it or bury it (random reinsert,
never bottom; the death shuffle preserves a kept top card). New generic
machinery: Overlay props `deckView` + `onDeckAction`, registry `skipBake`
(no canvas touched → no bake/state capture).

**Card framework hardening (2026-07-06, same verification pass):**
`card_anatomy.md` is now the card designer's contract — primitive
catalog, registry contract, invariant checklists, and the card-sheet
template every new card idea starts from. Two code fixes with it: deck
cards declare their own `deckActions` in the registry (Editor's fence is
built from them — the last per-card list left Editor.jsx), and the
registry dev-warns if a `MOD_CARDS` id has no entry.

**Card copy centralized (2026-07-07): `editor/cardText.js` is the ONLY
place card names + descriptions are written** (Stew edits them often).
`deck.js`/`foundryDeck.js` derive their labels from it, the card panels
import their description lines from it, and Foundry pre-fills a cast's
description box from it — home #0 in `card_anatomy.md`'s list.

**Copy overhaul + the copy editor (2026-07-07, Phase 1 built, awaiting
browser verification).** Stew is relaxing the universal zyme register
for nav copy — descriptions and navigation get more literal language
(card *names* keep the register). Infrastructure: user-facing copy is
migrating into `frontend/src/copy/uiText.json` (single source of
truth; `cardText.js` is now a shim re-exporting its `cards` section,
so every importer is untouched), edited live through
`tools/copy-editor.html`, served at `http://localhost:5174/copy-editor`
via `GET/POST /api/dev/copy` in `server.js` (POST walks the current
file's structure and takes only string leaves — a client can change
wording, never add/drop/reorder keys). Card names are pure copy —
renaming a card touches nothing in code; the id (`char`, …) is the
permanent key for files/registry/deck/art. So the tool's `CARD_GLOSS`
map (in the HTML, outside the editable copy) anchors each card group
with its id + a literal gloss of what the card does — renames never
orphan the fields. A gloss line is a per-card home now
(`card_anatomy.md` §5 item 0). Saving rewrites the JSON and
Vite hot-reloads the app; the reload destroys an in-progress session,
so copy edits happen between sessions. Phase 1 = the cards section,
end to end (round-trip verified via curl). Phase 2 (built, same
verification pass) = Deck nav copy migrated: DeckPanel, GridPicker,
HistoryOverlay, KeysReference (SECTIONS now derives from `UI.keys`),
Setup, Editor header/state captions, deck.js `progressLabel`, Plinth
captions, App loading — all through `UI`/`fmt` in `copy/uiText.js`
(pure; `{token}` templates) and `rich()` in `copy/rich.jsx`
(**strong**/*em*/`code` emphasis inside copy strings, so hints keep
markup without HTML in the JSON). Vite build verified. Phase 3 (built,
same pass) = the in-card hint strings: new sections `shared`
(Preparing…/take-one/shattering/work-glance), `brush` (the maskHint
sentences, `{subject}` per card), `cardHints` (per-card stage copy —
grid-pick titles/hints/confirms, Stamp's cutting/degraded, Etch's
frame/grain, Skim's beats + buttons, Cull's prompts, Delay's suffix,
Deeper's commit note, the Transfer pair). Rack's inline hint now reads
`CARD_TEXT.rack.description` like every other card. Phase 4 (built,
same pass) = Foundry nav copy: the `foundry` section (app/header/
commission/plate/panel/type/plateTint/ink/working/proof/progress)
feeds FoundryPanel, FoundryEditor's arc overlays, FoundryApp, and
foundryDeck (`PROOF_CARD` label + progress). The shared studio verbs
(End — commit, Deal, THIS ROUND, Committing…, Saved to:, Open output
folder) deliberately reuse `deckPanel` keys — one edit rewords both
apps. ALL FOUR PHASES BUILT; the whole migration awaits Stew's browser
verification (Phase 1–2 partially exercised: he already reworded card
descriptions through the tool). Slider labels (Hue/Size/Influence…)
and tooltips deliberately out of scope.

**Policy locked (notes §2): set-knowledge is free; order-knowledge and
order-control are never ambient** — the deal stays blind, the remains
stay unordered. Exceptions only as dealt/spent mechanics (Skim, Cull).

**Parallel track: Foundry, the card maker (`card_maker.md`; Phase 0
built 2026-07-07, awaiting browser verification).** A sibling app in
this repo for casting the card faces themselves — deck-driven
meta-sessions, plates + dealt fonts + graffiti. Core layer model (its
§3.5): the plate is an alpha *matte on top* (art shows through a
punched window), the type layer floats above it, one **Press** seals
the whole foundation to pixels, then the graffiti deck distorts the
sealed card. **2026-07-07 adjustments (its §1.1):** Proofs export to a
per-machine *casts folder* for hand curation, never directly into
`assets/cards/`; plates are Stew's 8 templates in `card_template/`
(2235×3120, real alpha windows, untracked) with the procedural
generator deferred; fonts are style-paired trios (mtg/pk/jp), one
style dealt per session, OFL faces committed under
`frontend/src/assets/fonts/` + proprietary Beleren/MPlantin as a
local-only backend overlay (`/api/fonts`). **Phases 0–3 verified:**
the scaffold (second Vite entry, parameterized raster/canvas), the
hollow session (`foundryDeck.js` + FoundryEditor/FoundryPanel/
foundryRegistry — commission chosen-with-deal-option), the plates
(`/api/plates`, matte-on-top mount), the panel (`/api/outputs`, art
under the window via `panelArt.js`, mask brush; the brush/arrange key
grammars now live in shared `editor/sessionBindings.js` — Editor.jsx
imports them). Phase 4 (fonts + type layer:
`fonts.js` catalog/style-deal/FontFace discipline, `typeLayer.js`
slots above the plate, N re-deals on living objects) and Phase 5
(graffiti wave 1: foundryRegistry points the 8 brush-core ids straight
at Deck's registry entries; `editor/colorSeed.js` extracted) are
verified. **Phase 6 built, awaiting browser verification:** `rarity.js`
(tier from commission copies; diamond/blot/ring mark as a fourth
nudgeable slot) + `POST /api/foundry/export` (745×1040 face + master
into `castsFolder`, default `<output>/foundry/`). **Control wave built
2026-07-07 (its §1.1: the base is controlled, only the graffiti is
chance), same verification pass:** plate chosen from the whole folder;
standing plate hue/sat tint until the Press (`plates.tintPlate`);
panel grid re-deals (N); dedicated `panelArtFolder` config key with
inputs+exports fallback (`/api/panel-art`); commission tiles show run
size ×N; Stamp ×3. After that: the Phase-7 backlog (graft wave,
procedural plates, direct-to-Deck…).

**Next actions (§-refs below are into the archived v4 notes
`archive/v4_design_notes.md`, and v3 `archive/version_3_design.md`; the
live list is also carried in `to_do/cards_plan.md` §0):** 1) Stew verifies
Wave 2 in the browser. 2) Playtest question (§7.2): does the splash-over
tension survive remains-knowledge + occasional order-control? 3) Wave 3 —
the descent experiment (§8.2): 1 Deeper dealt + 2 in reserve. 4) Later:
mid-state *pulling* (§9.3). Still open from v3: suits visible or
backstage (§10.1), Echo (§7.3), Mount (§7.4), death-crop (§6.5).

---

## 1. The project

**Deck** is a browser tool for digital collage driven by *drawing cards
from a deck*. Each card constrains the UI to exactly one action; the
user works within that constraint, then presses **End**, which commits
the result permanently and deals the next card.

**Core philosophy: destructive, commitment-based.** No global undo/redo
across committed steps; every End flattens the canvas to a single image.
Within a card you adjust freely (including within-card brush undo/redo);
after End it is baked in. Commitment is the central mechanic, not a
missing feature.

**The session arc** (v3 detail in `archive/version_3_design.md`): opening pick
(6×4 grid of 24; take two, strictly one *placed*, one *stashed*) →
placement (move/scale/rotate + the standing mask brush) → Act I (~4 mod
cards) → stash return → Act II (~2 rounds, then death cards shuffle in;
deal until one appears) → the Coda: the piece is complete, export at
full resolution.

**Card design rule: constraint outside, freedom inside.** No card may
simply *do something to the image* with no room for judgment — a blur is
a brush you compose with, not a filter that happens to you. Every card
is a short session of intentional editing within its constraint.

### Tone — this is not a game (macro design invariant)

Deck is an **artmaking tool**, not a game. It borrows game design — deck,
dealing, phases, randomness, commitment — purely to impose **constraint**
on a creative process. It must never *present* as a game.

- **Language is a studio/darkroom/press, not an arcade.** Avoid "play,"
  "win," "score," "level," "player," "turn." Prefer *draw, deal, commit,
  compose, finish, export, this round.* "Card" and "deck" stay.
- Card names use the **zyme register**: one concrete process word (Bruise,
  Steep, Stain, Char, Cure), never a settings-menu label
  (`archive/version_3_design.md` §4). Subliminal Etch is the one deliberate
  two-word exception.
- **No celebratory / gamer affect.** A piece is *finished*, not beaten.
- **The legibility clause (2026-07-10, Stew's ruling):** the register is
  not a totalizing rule. Some things are better named legibly than
  creatively for the sake of UX — navigation and utility surfaces
  especially, where a flavored name would cost the user clarity. The rule
  exists to keep *game* affect out, not to make the UI oblique. First
  case: the deck-assembly room is plainly the **Deck editor** on screen
  (the §6 candidates *case/drawer/tray/press bed* were passed over for
  exactly this reason). Card *names* keep the register.
- **"Death card" is a design-conversation term, never UI copy** — on
  screen it's the **Coda**.
- Apply to everything user-facing: copy, labels, states, new names.

---

## 2. Working agreement (do not violate)

The user (Stewart, "Stew") is **not a programmer by trade** — he uses
git and VS Code and reads JS/Python, but doesn't write code from
scratch. He wants to *understand* the architecture, not just receive
working code he can't maintain.

- **Build in phases, stop at every checkpoint.** One unit at a time:
  summarize what was built, explain the *one* key concept in plain
  language, wait for "continue." The active plans' waves are the
  checkpoint map (`to_do/cards_plan.md` §7 · `to_do/app_plan.md` §7).
- **Check in before any non-trivial implementation** — present the
  options before coding; `AskUserQuestion` helps make choices concrete.
- **Keep code small and readable.** Boring/idiomatic > clever.
- **Verify Fabric 6.x APIs against the installed version** — the
  drawing/eraser/filter APIs changed across major versions; don't guess.
- **Claude writes code; Stew verifies in the browser.** Hand him clear
  test steps and wait; he doesn't run code on Claude's behalf unless asked.

**Cross-machine setup.** The repo is cloned on Arch Linux (primary,
`/home/stewrat/`), Mac (`/Users/stewartbird/`), and Windows
(`C:\Users\birds\`). Never hardcode input/output paths — they're chosen
in Setup and persisted per machine to `~/.deck-config.json` (home
directory, not the repo).

---

## 3. Tech stack

- **Frontend**: Vite 5 + React 18 + **Fabric.js 6.x**. Plain JavaScript,
  no TypeScript. React `StrictMode` is intentionally disabled in
  `main.jsx` — Fabric doesn't tolerate the double-effect dev behavior.
- **Backend**: Node 20+ + Express 4. Files only: reads/serves images,
  writes the export PNG, persists folder config. No deck logic.
- **Python 3.10+ FastAPI sidecar**: rembg cutouts + Real-ESRGAN 4×
  upscale on ONNX Runtime, CPU-only (models committed in
  `backend/ml/models/`). Per-machine venv at `backend/ml/.venv` (README);
  auto-started by `npm run dev`, exits politely without a venv; proxied
  under `/api/ml/*`. **Graceful degradation is a requirement** — the
  session never blocks on ML.
- **Communication**: REST on localhost; Vite proxies `/api/*` → Express
  on :5174. JSON body limit 64 MB (one full-res base64 export).

**Architectural invariant: frontend = brain, backend = hands.** Deck
state, canvas logic, and card behavior live in React; Express and the
sidecar exist only for what the browser sandbox can't do (filesystem,
heavy ML). If it doesn't touch a file or a model, it doesn't belong in
the backend.

---

## 4. Repo layout

```
zymeDraw/
├── CLAUDE.md · README.md · hotkeys.md   # this file / setup / hotkey map
├── card_anatomy.md · card_maker.md      # card designer's contract (§11) · Foundry spec
├── to_do/                               # ACTIVE PLANS — in progress; archived when done
│   ├── app_plan.md                      #   infra line: glue / ZYME / packaging / stream / design
│   ├── cards_plan.md                    #   card line: Kid Pix cards + the deck builder
│   └── server_plan.md                   #   recursion server + switchboard founding doc
├── archive/                             # done/superseded plans + one-off records
│   ├── design_changes_july2.md · redesign_v2_plan.md · version_3_design.md  # v1–v3
│   ├── v4_design.md · v4_design_notes.md   # v4 spec + design notes (shipped)
│   ├── shattered_transfer_plan.md       # retired style-transfer card plan
│   ├── debug_loop.md · debug_loop_findings.md   # June /loop debug run
│   └── ui_flexibility_audit.md · classifiers.md # one-off audit · early scratch note
├── cardPNG/                  # local-only placeholder card art (gitignored)
├── frontend/src/             # main.jsx · App.jsx · Setup.jsx
│   ├── assets/cards/         # card faces <id>.png, 745×1040
│   └── editor/
│       ├── Editor.jsx        # registry dispatcher (no per-card logic!)
│       ├── DeckPanel.jsx     # right sidebar: phase panels + Tools + End
│       ├── deck.js           # PURE state machine + selectors
│       ├── masterRaster.js   # offscreen 2400×3000 truth + universal bake
│       ├── brushCore.js      # stroke engine: mask + reveal sessions
│       ├── Card.jsx · cardArt.js · CardZoom.jsx · HistoryOverlay.jsx
│       ├── keymap.js · KeysReference.jsx · CanvasStage.jsx · GridPicker.jsx
│       ├── placement.js · PlacementLayers.jsx · sampling.js · shatter.js · Plinth.jsx
│       └── cards/            # registry.jsx + one file per card + the factories
└── backend/
    ├── server.js             # all Express routes + /api/ml proxy
    ├── config-store.js       # ~/.deck-config.json
    └── ml/                   # sidecar: main.py · upscaler.py · start.js
                              #   · models/ (committed .onnx) · tools/
```

---

## 5. The two patterns that hold everything together

### 5.1 The deck state machine (`editor/deck.js`)

A **pure reducer** — no Fabric, no DOM, no side effects. It holds card
ids and filenames, never images or canvas objects; the whole session
rulebook should read in two minutes. All tuning numbers live in one place
(`TUNING` + `MOD_CARDS`). The v4 selectors (`spentCards`,
`remainingCounts`) derive the deck-overlay views — order-stripping and
death-filtering happen here, never in the UI.

### 5.2 The card registry (`editor/cards/registry.jsx`)

`Editor.jsx` doesn't know what any card does — it looks up
`cardRegistry[id]` and calls lifecycle hooks (`begin`/`update`/`commit`/
`cleanup`, plus a `Tools` component and control declarations). Adding a
card = ONE registry entry + ONE behavior file. **Never add per-card
branches to Editor.jsx or DeckPanel.jsx** — extend the registry shape
with an optional field Editor applies generically (current shape in
`registry.jsx`'s header comment: `Overlay`, async `commit`,
begin-awaits-user, `hotkeys`, `skipBake`, …).

**The contract:** after a card's `commit`, Editor performs the
**universal bake** — the canvas flattens into the single base image at
master resolution. Cards never implement flattening; there is only ever
one committed layer. Cards build on the shared modules (brush core, grid
pickers, placement sessions), not on Editor special cases.

---

## 6. Backend notes

Routes live in `backend/server.js` — read them there. Patterns to
preserve: tilde expansion via `expandTilde`, path-traversal safety
(`path.basename()` + `startsWith` check), re-validate folders on every
request, and `/api/images/sample` stays registered BEFORE
`/api/images/:filename`.

---

## 7. Live invariants

- **Canvas is fixed portrait**: working view 800×1000, master/export
  2400×3000. The master raster holds the true pixels; the visible canvas
  is a scaled proxy. Bakes and ML passes happen at master resolution;
  export writes the master directly.
- **No session round-cap** — only a death card ends a session. Pacing is
  tuned by deck composition + death count in `deck.js`.
- **The mask brush is a standing tool, not a card** — available whenever
  images are placed (op key in code stays `conceal`). Masks are
  image-native; they travel through move/scale/rotate.
- **Within-card undo/redo exists for brushes only, never across End.**
- **Global modifiers are banned except color adjustments**, which must
  carry an influence slider (Steep, Hue, Cure).
- **Color pickers start on a random hue.** Any control named `color` is
  seeded per deal (`randomizeColors` in `Editor.jsx`) — new color cards
  get this for free by naming the control `color`.
- **A card may own the viewport for its session** (Etch), but must
  restore the identity transform in both commit AND cleanup — the bake
  snapshots through the current viewport; a leaked zoom bakes wrong.
- **Every card face renders through `Card.jsx`** at 745×1040 — nothing
  else may hardcode card geometry.
- **Deck legibility (v4)**: set-knowledge is free, order-knowledge and
  order-control are never ambient; the Coda never appears in REMAINS.
  The `deck.js` selectors enforce this, not the UI.
- **The two-press rhythm (End, then Deal) is the design** — auto-deal was
  tried and reverted. Don't re-remove the Deal panel.
- **Browser tab dependency**: closing the tab loses in-progress work. By
  design — commitment is the mechanic.

---

## 8. Known issues / things to verify

- **Bakes render at 3×** — filter-heavy cards could hit WebGL texture
  caps at bake time on conservative devices; verify across machines.
- **2d `ctx.filter` needs Safari 18+** — Blur/HSV brushes and Ghost's
  brightness/contrast silently no-op there. Fine on Chrome/Firefox/Edge.
- **Linux**: the folder dialog needs `zenity`/`kdialog` (hand-typed
  paths still work); `xdg-open` may be missing (open-output fails silently).
- **Filter flush race on End**: `renderAll()` runs right before the
  snapshot; if a bake/export ever mismatches the screen, look here first.
- **Sidecar cold start**: models lazy-load — the first Stamp/Deeper of a
  session is slow. Communicate it in the UI, don't spinner-block.

---

## 9. How to run

```
npm run install:all     # first time only
npm run dev             # frontend :5173, backend :5174, sidecar
```

Open <http://localhost:5173>; Setup prefills from `~/.deck-config.json`.
Hotkeys: **Space** = deal, **Enter** = primary action, **Shift+R** =
restart; the full map is **`hotkeys.md`** (the decision record + live
reference). `editor/keymap.js` dispatches — suppressed while focus is in
a form control; `KeysReference.jsx` is the in-app overlay.

---

## 10. Style notes for code

- Plain JavaScript everywhere; JSX files use `.jsx`. No TypeScript.
- One file per card behavior, exporting its hooks AND its Tools component.
- Shared infrastructure lives in its own module under `editor/`,
  imported by cards — not baked into Editor. (§5's rules are style rules
  too: `deck.js` stays pure; no per-card branches in Editor/DeckPanel.)
- Comments only when the *why* isn't obvious.
- React StrictMode stays OFF — don't re-enable it.
- All user-facing copy obeys the §1 tone invariant.

---

## 11. How to add a new card

**Start with `card_anatomy.md`** — fill in its §9 card sheet before any
code; its checklists (§7 canvas, §8 deck) are the review. Then:

1. Design freedom inside the constraint (§1); name it in the zyme
   register. Add the descriptor + copy count to `deck.js`.
2. Create `editor/cards/<name>.jsx` on the shared modules; add a
   registry entry. Don't touch `Editor.jsx` / `DeckPanel.jsx`.
3. Drop `assets/cards/<id>.png` (745×1040) — text face stands in until then.
4. Hand Stew browser test steps; wait for verification before commit.

### Where to start a fresh session

This file (§0 is the state) → the active plan for the work at hand
(`to_do/cards_plan.md` for cards, `to_do/app_plan.md` for infrastructure;
the shipped v4 spec is `archive/v4_design.md` + notes) → `editor/deck.js`
(the session rulebook) → skim `cards/registry.jsx` and one nearby card
file. Check in with Stew before non-trivial work (§2): build one unit,
checkpoint, wait for "continue."
