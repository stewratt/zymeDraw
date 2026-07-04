# CLAUDE.md — Deck (zymeDraw)

> This file is the persistent context for any Claude Code session in this repo.
> Read it top-to-bottom before doing any work. It captures the invariants and
> architectural decisions of a project in active iteration.

---

## 0. Current state — resume here (updated 2026-07-02)

**v1 is complete and committed on `main`.** All eight v1 phases shipped
(scaffold → layers-panel redesign, plus the tone cleanup). The code in the
repo right now is v1.

**The project is at the start of the v2 redesign.** Playtesting v1 exposed
core problems: add-cards flooded the canvas and made image placement feel
cheap, several cards "just did something" with no room for judgment, and layer
management fought the commitment philosophy. The redesign is specified in two
documents — read both before doing v2 work:

- `design_changes_july2.md` — Stew's raw design notes (the *why*)
- `redesign_v2_plan.md` — the agreed plan of attack (the *what and how*;
  11 phases, architecture pillars, target card set)

**Decisions locked with Stew on 2026-07-02** (details in the plan's §0):

1. **Literal finite shuffled deck** — a real card list with copy counts,
   shuffled and dealt from the top. Long-term goal: grow the card library
   until sequences feel unique each session. Cards are *named, opinionated
   chains of events* ("Ghost"); variants may share a chain with one deliberate
   alteration.
2. **Death card = instant end.** No final modification. (Open variant parked
   for later: death cards may offer one terminal *crop* choice — "death crop".)
3. **Python FastAPI sidecar** for rembg + Real-ESRGAN, proxied by Express,
   with mandatory graceful degradation.
4. **In-app dice-styled rolls** (assumed, not explicitly confirmed — cheap to
   change until Phase 3's roll UI exists).

**Phase 1 is done (2026-07-02, on the `v2` branch):** `deck.js` is the v2
session-script reducer (literal shuffled deck, opening rolls, pick/stash,
placement, acts, stash return, Coda instant-end), with stub per-phase panels
in `DeckPanel.jsx` so the whole arc is clickable. Decisions made in Phase 1:
death card displays as **Coda**; stash returns as **one placement session**;
rolls are grid `8+d8` (9–16), pick `1+d3` (take up to 2–4).

**Phase 2 is done (2026-07-02):** the master-raster design was approved and
built — `editor/masterRaster.js` holds the offscreen 2400×3000 truth; the
visible canvas is a scaled proxy showing it as a background image whose
*source* stays full-res, so bakes never degrade. Editor runs the universal
bake after every card commit and placement End; export writes the master
directly (no multiplier — the v1 blank-PNG export bug path is gone). The
layers infrastructure (`LayersPanel.jsx`, `layers.js`) and all obsolete v1
card files were deleted; `@erase2d/fabric` was uninstalled; the registry is
an empty object documenting the v2 contract; `pencil.jsx` survives
unregistered as brush-core reference.

**Phase 3a is done (2026-07-02):** dice-styled roll reveal confirmed with
Stew (plan §0.4 no longer assumed) and built — `GridPicker.jsx` is a shared
canvas-area overlay (dice tumble → thumbnail grid → place/stash cycling);
`placement.js` loads chosen images as free-transform objects (Ghost/Stamp
will reuse both); backend gained `GET /api/images/sample?n=` (registered
before `/api/images/:filename`); `deck.js` rolls now store individual die
faces (`gridDie`/`pickDie`) so the reveal shows the arithmetic and a manual
physical-dice mode stays a drop-in. End is disabled until placement images
finish loading.

**Phase 3b is done (2026-07-02):** `brushCore.js` — the universal brush
core in erase mode. Per-image native-resolution mask + composite
(destination-out); strokes never touch source pixels; hard/soft dabs;
stroke-replay undo/redo (Cmd/Ctrl+Z, +Shift) that never crosses an End;
topmost-image stroke targeting; Arrange/Erase mode toggle in the placement
panel. Erase is live in every placement session (opening + stash return).

**Phase 4 is done (2026-07-02, verified by Stew):** brushCore refactored
into a shared stroke engine with two consumers — erase (destination-out on
placed images) and **reveal** (`createRevealSession`: full-strength
effected copy of the master as a non-interactive overlay, fully masked
out, painting reveals it; Influence = globalAlpha re-blend, never a
recompute). `cards/noiseBrush.jsx` is the first real registry card; cards
report `undo/redo/canUndo/canRedo` via ctx.report and Editor's Cmd/Ctrl+Z
routes to them generically. Master-res painting performance confirmed fine
on the Mac. pencil.jsx deleted (reference job done).

**Phase 5 is done (2026-07-02, verified by Stew):** the non-ML deck is
playable — 6 of 10 card designs are real. `cards/effectCardFactory.jsx`
(an effect card = one `applyEffect` function + sliders; shared
`BrushControls`); Noise migrated onto it; **Blur brush** and **HSV brush**
(canvas-2d `ctx.filter` — needs Safari 18+, note in the card files);
**Color Overlay** (full-canvas blended Rect: color / influence /
multiply·screen·overlay·color) and **Global HSV** (shifted-master overlay
at influence opacity) — both carry the mandatory influence control;
**Reposition** (master becomes a free-transform object + Flip H/V).
Color Overlay's bake also proved `globalCompositeOperation` survives
`toCanvasElement` — half of §9's Ghost spike.

**Phase 6 is done (2026-07-02, verified by Stew):** **Ghost** — the first
multi-sequence card: fresh grid of 8 (dice-free `CardGridPicker`, the
single-pick grid variant Stamp will reuse) → take one → placed in `screen`
blend with opacity + brightness/contrast (2d `ctx.filter` on a redrawn
source canvas — never Fabric WebGL filters) + the standing erase brush.
Pattern established: a card's `begin` can *await the user* (the pick
resolves a promise), keeping End disabled until the choice is made; the
registry gained a generic optional `Overlay` component (canvas-area UI,
same props as Tools) and begin's ctx gained `isCancelled` for async cards.
`sampling.js` extracted (shared by opening grid + grid cards). The §9
`screen`-blend spike is closed: blend modes survive the bake (verified in
Stew's export).

**Phase 7 is done (2026-07-02, verified by Stew):** the ML sidecar —
`backend/ml/` FastAPI app (`/health`, `/cutout` via rembg, `/upscale` via
Real-ESRGAN), all on **ONNX Runtime, CPU-only** (decision locked with
Stew: no torch). The ESRGAN model (`realesr-general-x4v3`) is **committed
in-repo** (~5 MB onnx, converted from the official xinntao release —
conversion + verification script in `backend/ml/tools/`); rembg's u2net
(~170 MB) auto-downloads to `~/.u2net` on first cutout. Express proxies
`/api/ml/*` (raw-byte passthrough, no new npm deps); `npm run dev` gained
an `ml` process via `backend/ml/start.js`, which exits politely when
`backend/ml/.venv` is missing. Degradation verified: sidecar down →
health `{ok:false}` + fast 503s, nothing blocks. README documents the
once-per-machine venv setup; the Mac's venv is already set up. Measured
on the Mac (CPU): 400×500→×4 upscale in ~2 s; cutout in seconds once the
model is cached.

**Phase 8 is done (2026-07-02, verified by Stew):** **Stamp** — grid of 6
→ take one → its bytes go through `/api/ml/cutout` and the rembg cutout is
placed for arrange/opacity + the standing erase brush. Three-stage chain
(pick → cutting → work) with the cutting wait explained in the panel while
End stays disabled. Degradation live: sidecar down / cutout failure → the
whole image is placed and the panel says "the erase brush is your
scissors". The Ghost/Stamp shared Arrange/Erase block was extracted to
`cards/arrangeEraseControls.jsx`. 8 of 10 card designs are real.

**Phase 9 is done (2026-07-02, verified by Stew):** **Deeper** — a
4:5-locked frame rect (corner-scale + rotate only; side handles hidden so
portrait is preserved by construction) chooses the piece's re-frame; End
maps that region onto the full master by 2d transform, then restores
detail via `/api/ml/upscale` when zoom > 1.05 — the input is resampled at
its *true* source detail (master/zoom, clamped 600–1200 px wide) so the
×4 model only invents what's missing. Degradation: the plain resample
stands. Editor gained **async commit hooks** generically: `handleCommit`
awaits `entry.commit`, End shows "Committing…", a ref guards re-entry,
Restart waits for an in-flight commit. 9 of 10 card designs are real.

**Phase 10 is done (2026-07-02, verified by Stew):** **Rails** — a
random image is dealt and read for its *most shattered* form
(`editor/shatter.js`, later shared with Shattered Transfer): the winning
mask becomes a solid-color cutout (random-hue-seeded picker) you arrange,
tint, fade, and erase with the standing brush. Pure canvas2d — no sidecar.
10 of 10 card designs are real.

**v3 (branch `v3`, off `main`, 2026-07-03) — the card system redesign**
(`version_3_design.md`): mechanic × suit anatomy, the zyme naming register,
a simplified opening, mask/soften standing tools, new play shapes. All six
build-order steps are built (steps 3–6 in one pass at Stew's request —
**awaiting his single revision round**):

1. **Opening simplified** — no dice; a fixed **6×4 grid of 24** (was 5×5/25
   in the doc; changed for screen fit — the grid always fits the canvas
   area with no scroll, cells shrink with the window). Strict take-two:
   exactly one placed, one stashed (decided with Stew, as were: dice leave
   the product entirely; "stash" keeps its plain name). Place/stash picks
   are marked muted green/amber — the one deliberate color exception in
   the greyscale UI.
2. **Mask brush + soften** — erase grew into the standing mask brush:
   **Arrange · Conceal · Restore · Soften** (labels decided with Stew).
   Conceal = old erase; restore paints the mask back out (masks are
   image-native so they travel with the image — reposition-then-correct
   works by construction); soften lerps the mask toward a blurred copy of
   itself under the stroke (feather radius = half the dab radius, decided
   with Stew; needs Safari 18+ like the other ctx.filter effects).
   `applyMaskOp`/`snapshotMaskSettings` exported from brushCore;
   `cards/maskControls.jsx` replaced `arrangeEraseControls.jsx`.
3. **Renames (zyme register, §4.3 of the doc, all-at-once)** — Noise→**Silt**,
   Blur→**Dissolve** (kept, one copy, provisional per §6.3), HSV
   Brush→**Bruise**, Global HSV→**Turn**, Color Overlay→**Steep**,
   Reposition→**Rack**. Files, registry keys, and deck ids all renamed to
   match (`silt.jsx`, `dissolve.jsx`, `bruise.jsx`, `turn.jsx`,
   `steep.jsx`, `rack.jsx`).
4. **Suit siblings** — **Stain** (Graft × Sink: Ghost's multiply twin;
   `graftCardFactory.jsx` now holds the shared Graft chassis and Ghost/
   Stain are thin configs), **Char** (Stencil × Sink: Rails' fragments as
   a grey multiply burn with a Depth slider), **Cure** (Wash × soft light:
   soft-light self-overlay + influence).
5. **Pore** — built as the first *duration card* (multi-round enclosure),
   then **replaced by Etch in the revision round** (below). The enclosure
   machinery (`state.enclosure`, `bakeRegion`, `ctx.view`, `reframes`/
   `endsEnclosure`) was deleted with it; git history has it all if a
   duration card ever comes back.
6. **Deck tuning** — the §8 target list is live in `deck.js`: 19 mod cards
   (Ghost 2, Stain 2, Stamp 2, Rails 1, Char 1, Deeper 2, Rack 1, Silt 2,
   Bruise 1, Dissolve 1, Steep 1, Turn 1, Cure 1, Subliminal Etch 1) +
   Coda 3.

**Revision round (started 2026-07-04, in progress):** Stew is playtesting
the whole branch and feeding back. Landed so far:

- **Pore → Subliminal Etch.** Playtest failure: Deeper dealt right after
  Pore ended the enclosure before its payoff (the zoom-out reveal) ever
  happened — the multi-round design collided with the deck. Subliminal
  Etch (Stew's idea and his name — the one deliberate two-word exception
  to the register; decisions: fixed-size frame, position only) is
  self-contained: drag a small fixed frame (96×120 *master* px, snapped
  to the master grid), Zoom in — the card owns the viewport for its
  session — and draw a tiny glyph with a solid-color pixel brush at the
  master's grain (1 master px ≈ 8 screen px; bg `imageSmoothing` off
  while zoomed so the piece's true pixels show). End recedes and the
  universal bake lands the glyph 1:1. Color control is named `color` so
  it opens on a random hue. `cards/etch.jsx`; snapshot-based undo/redo.
- **Mask-mode icons.** Arrange · Conceal · Restore · Soften are now icon
  buttons (move-arrows / eraser / brush / feathered dot — inline SVGs in
  `maskControls.jsx`), name on hover; the words were hard to teach.

Still open from the doc: suits visible or backstage (§10.1), Echo (§7.3),
Mount (§7.4), death-crop (parked since v2). **Next action: more of Stew's
revision feedback.**

**Style-transfer experiment (branch `style-transfer`, off `v2`,
2026-07-03):** fast-neural-style (ONNX zoo, pointillism to start; Stew
plans to train his own styles later) added to the sidecar — model
committed at `backend/ml/models/style-pointilism.onnx` (patched to
dynamic input dims, provenance in `tools/patch_style_model_dynamic.py`),
`/style` endpoint in `styler.py`/`main.py`, Express proxy extended
(`style` op + query-string forwarding). Two experiment cards:
**Transfer** (`cards/transfer.jsx` — whole-canvas styled overlay,
influence + standing erase brush) and **Shattered Transfer**
(`cards/shatteredTransfer.jsx` — grid pick → the image is read as a
stencil via the shared `editor/shatter.js` (extracted from Rails) → a
live free-transform window through which the styled redraw shows;
plan in `shattered_transfer_plan.md`). Shared `editor/styleTransfer.js`
fetch; `createStrokeEngine`/`makeLayer`/`clearLayer` now exported from
brushCore for card-owned composites.

**Status — stashed for later (2026-07-03):** both Transfer cards have been
**removed from the deck** — the demo ONNX styles (pointillism, rain-princess)
don't look good enough to ship. **Stew intends to return to this feature once
he has trained his own style model.** Nothing was deleted: the two card files,
their registry entries, the shared `styleTransfer.js`/`shatter.js` modules,
the `/style` sidecar endpoint, and the committed demo models all remain in
place. Only the two `MOD_CARDS` lines in `deck.js` are commented out — re-add
them (and swap in the trained model) to bring the feature back.

> Keep this §0 updated as v2 phases land; it's the resume point for every
> fresh session.

---

## 1. The project

**Deck** is a browser tool for digital collage whose workflow is driven by
*drawing cards from a deck*. Each card constrains the UI to exactly one
action — placing images, painting an effect with a brush, re-framing the
canvas — the user works within that constraint, then presses **End**, which
commits the result permanently and deals the next card.

**Core philosophy: destructive, commitment-based.** There is no global
undo/redo across committed steps. In v2 this goes further: **every End
flattens the canvas to a single image.** No layers persist between cards.
Within a card you can adjust freely (including within-card brush undo/redo);
after End it is baked in. Commitment is the central mechanic, not a missing
feature.

**The session arc** (v3; the v2 arc with the opening simplified — v3
detail in `version_3_design.md`):

1. **Opening pick** — a fixed 6×4 grid of 24 images sampled from the input
   folder. Take two, strictly: one *placed now*, one *stashed* for later.
2. **Placement** — arrange the placed image with move/scale/rotate and the
   standing **mask brush** (conceal / restore / soften — masking hard edges
   is core to collage; the brush is a standing tool whenever images are
   placed, not a card).
3. **Act I** — deal ~4 modification cards from the shuffled deck.
4. **Stash return** — the stashed image comes back as a placement session.
5. **Act II** — ~2 more rounds, then death cards are shuffled into the
   remaining deck; keep dealing until one appears.
6. **Death card** — the piece is complete. Export at full resolution.

**Card design rule: constraint outside, freedom inside.** No card may simply
*do something to the image* with no room for judgment (v1's Flip Canvas was
the canonical offender). Every card offers a short session of intentional
editing within its constraint — a blur is a brush you compose with, not a
filter that happens to you. Global whole-canvas modifiers are banned *except*
color adjustments, and those must carry an influence/opacity control.

### Tone — this is not a game (macro design invariant)

Deck is an **artmaking tool**, not a game. It *borrows* game design — a deck,
dealing, rolls, phases, randomness, commitment — purely to impose
**constraint** on a creative process. The experience must never *present* as
a game.

- **Language is a studio/darkroom/press, not an arcade.** Avoid "play," "win,"
  "score," "level," "player," "turn." Prefer *draw, deal, commit, compose,
  finish, export, this round.* "Card" and "deck" stay — they're the
  instrument, not a genre signal. (Dice left the product in v3 step 1.)
  v3 adds the **zyme register** for card names: one concrete process word —
  Silt, Bruise, Turn, Steep, Rack, Stain, Char, Cure — never a
  settings-menu label (`version_3_design.md` §4). Subliminal Etch is the
  one deliberate two-word exception (Stew's call, revision round).
- **No celebratory / gamer affect.** No win-states or congratulatory copy.
  The end is a piece being *finished*, not a level being *beaten*.
- **"Death card" is a design-conversation term, not UI copy.** On screen the
  card is named **Coda** (decided in Phase 1).
- **Apply this to everything user-facing:** copy, labels, card names, states,
  and the names of anything new.

---

## 2. Working agreement (do not violate)

The user (Stewart, "Stew") is **not a programmer by trade.** They use git
and VS Code, can read JS/Python, but cannot write code from scratch. They
explicitly want to *understand* the architecture as the project grows, not
just receive working code they can't maintain.

**These are non-negotiable unless the user changes them in-session:**

- **Build in phases, stop at every checkpoint.** Implement one unit at a
  time, summarize what was built, explain the *one* key concept it introduced
  in plain language, then wait for "continue." The v2 plan's phases are the
  checkpoint map.
- **Before any non-trivial implementation, check in first.** If a step needs
  a clever or unfamiliar technique, pause and present the options before
  coding. Use `AskUserQuestion` if it helps make the choice concrete. (The
  master-raster design in Phase 2 is explicitly flagged for this.)
- **Keep code small and readable.** Comment the non-obvious parts only.
  Boring/idiomatic > clever.
- **No global undo/redo across commits.** Within a single card the user can
  adjust freely (v2 adds within-card brush undo/redo); after End it is
  irreversible. This is by design.
- **Verify current library APIs before using them.** Fabric.js has changed
  its drawing/eraser/filter APIs across major versions. We target Fabric 6.x.
  Check the actual installed version's API rather than guessing.
- The user does not run code on Claude's behalf unless asked. **Claude
  writes code; the user verifies in the browser.** Hand the user clear test
  steps and wait.

**Cross-machine setup.** The repo is cloned to:
- Linux (Arch) — primary, `/home/stewrat/`
- Mac laptop — `/Users/stewartbird/`
- Windows — `C:\Users\birds\`

Never hardcode input/output folder paths. They're chosen at runtime in the
Setup UI and persisted to `~/.deck-config.json` per machine. The v2 Python
sidecar must follow the same rule: per-machine setup documented in README,
no hardcoded paths.

---

## 3. Tech stack

- **Frontend**: Vite 5 + React 18 + **Fabric.js 6.x** for the canvas. Plain
  JavaScript (no TypeScript). React `StrictMode` is *intentionally disabled*
  in `main.jsx` because Fabric doesn't tolerate the double-effect dev
  behavior.
- **`@erase2d/fabric`** — dropped in v2 Phase 2 (uninstalled). The universal
  mask-based erase brush (Phase 3b) replaces it.
- **Backend**: Node 20+ + Express 4. Reads/serves images, writes the export
  PNG, reveals the output folder, persists folder config. No deck logic.
- **Python 3.10+ + FastAPI sidecar** (shipped in v2 Phase 7): rembg
  (cutouts) + Real-ESRGAN 4× upscale, both on **ONNX Runtime, CPU-only**
  (~150 MB venv, no torch). The ESRGAN onnx model is committed in-repo
  (`backend/ml/models/`; provenance script in `backend/ml/tools/`). Venv
  lives at `backend/ml/.venv` per machine (README); auto-started by
  `npm run dev` via `backend/ml/start.js` (exits politely if no venv).
  Proxied by Express under `/api/ml/*`. **Graceful degradation is a
  requirement**: the session never blocks on ML.
- **Communication**: plain REST on localhost. Vite proxies `/api/*` → Express
  on port 5174. JSON body limit 64 MB (holds one full-res base64 export).
- **Dev runtime**: `npm run dev` at repo root uses `concurrently`;
  first-time install is `npm run install:all`.

**Architectural invariant: frontend = brain, backend = hands.** The deck
state machine, canvas logic, and card behavior live in React. Express (and
the Python sidecar) exist only for what the browser sandbox can't do:
filesystem and heavy ML inference. If new functionality doesn't touch a file
or a model, it doesn't belong in the backend.

---

## 4. Repo layout

```
zymeDraw/
├── CLAUDE.md                 # this file
├── README.md                 # install/run + once-per-machine Python setup
├── design_changes_july2.md   # v2 design notes (source of truth for the why)
├── redesign_v2_plan.md       # v2 plan of attack (source of truth for the how)
├── package.json              # root: `concurrently` + scripts (3 dev processes)
├── frontend/
│   └── src/
│       ├── main.jsx          # React entry; StrictMode disabled by choice
│       ├── App.jsx           # top router: loading → setup → editor
│       ├── Setup.jsx         # folder-picker screen
│       └── editor/
│           ├── Editor.jsx       # registry dispatcher (no per-card logic!)
│           ├── CanvasStage.jsx  # Fabric canvas, forwarded ref
│           ├── DeckPanel.jsx    # right sidebar: per-phase panels + Tools + End
│           ├── deck.js          # PURE state machine — the session script
│           ├── masterRaster.js  # offscreen 2400×3000 truth + bake/bakeRegion
│           ├── brushCore.js     # stroke engine: mask + reveal sessions
│           ├── GridPicker.jsx   # opening pick overlay + CardGridPicker (single-pick)
│           ├── placement.js     # free-transform placement sessions
│           ├── sampling.js      # random-sample fetch w/ client fallback
│           ├── shatter.js       # stencil reading (Rails, Char, Shattered Transfer)
│           ├── editor.css
│           └── cards/
│               ├── registry.jsx        # one entry per card
│               ├── effectCardFactory.jsx  # reveal card = applyEffect + sliders
│               ├── graftCardFactory.jsx   # graft card = grid pick + blend config
│               ├── maskControls.jsx       # standing-brush UI (Arrange·Conceal·Restore·Soften)
│               ├── ghost.jsx / stain.jsx  # Graft × Rise / × Sink (thin configs)
│               ├── stamp.jsx / rails.jsx / char.jsx
│               ├── silt.jsx / dissolve.jsx / bruise.jsx
│               ├── steep.jsx / turn.jsx / cure.jsx
│               ├── deeper.jsx / rack.jsx  # re-frames
│               └── etch.jsx               # pixel glyph at the master's grain
└── backend/
    ├── server.js             # all Express routes (see §6) + /api/ml proxy
    ├── config-store.js       # reads/writes ~/.deck-config.json
    └── ml/                   # the sidecar (Phase 7)
        ├── main.py           # FastAPI: /health /cutout /upscale
        ├── upscaler.py       # tiled Real-ESRGAN x4 on onnxruntime
        ├── requirements.txt  # venv deps (install per machine, README)
        ├── start.js          # npm-run-dev launcher; no venv → polite exit
        ├── models/           # realesr-general-x4v3.onnx (committed, ~5 MB)
        └── tools/            # one-time pth→onnx conversion (provenance)
```

The config file `~/.deck-config.json` lives in the user's home directory,
NOT the repo. Each machine has its own.

---

## 5. The two patterns that hold everything together

### 5.1 The deck state machine (in `editor/deck.js`)

`deck.js` is a **pure reducer**. It has no knowledge of Fabric, the DOM, or
any side effect. It holds card ids and filenames, never images or canvas
objects. Anyone reading it should understand the entire session rulebook in
two minutes. **This purity rule survives v2 unchanged.**

The v1 machine (phases BEGINNING/MIDGAME/ENDGAME_DRAWN, draw-with-replacement
pools, endgame threshold) is what's in the file today. **v2 Phase 1 replaces
it** with the session script: opening rolls → grid pick + stash → placement →
Act I → stash return → Act II → death cards shuffled in → complete. State
sketch and pacing knobs are in the plan's §2.2. All tuning numbers (act
lengths, deck copy counts, death count, dice mappings) live in one place in
this file.

### 5.2 The card registry (in `editor/cards/registry.jsx`)

`Editor.jsx` doesn't know what any specific card does. It looks up
`cardRegistry[currentCard.id]` and calls lifecycle hooks
(`begin` / `update` / `commit` / `cleanup`, plus a `Tools` component and
control declarations). Adding a new card = ONE registry entry + ONE behavior
file. **Never add per-card branches to Editor.jsx or DeckPanel.jsx** — if a
card needs something the registry shape can't express, extend the shape with
an optional field that Editor applies generically.

**v2 changes to the contract** (built in Phase 2):
- After a card's `commit` hook runs, Editor performs the **universal bake**:
  the whole canvas is flattened into the single base image at master
  resolution. Cards never implement flattening.
- The layers panel, `deckId/deckLabel/deckKind` tagging, `layerKinds`, and
  `targetLayerId` all go away — there is only ever one committed layer.
- New shared infrastructure cards opt into instead: the **brush core**
  (erase mode / effect-mask mode) and the **image grid picker** (opening,
  Ghost, Stamp). These are shared modules, not Editor special cases.

---

## 6. Backend API

| Route | Purpose |
|---|---|
| `GET /api/ping`              | Sanity check `{ ok: true }`. |
| `GET /api/config`            | Returns `{ inputFolder, outputFolder, homedir }`. |
| `POST /api/config`           | Validates both paths, persists `~/.deck-config.json`. |
| `POST /api/pick-folder`      | `{ mode:'read'\|'write', current? }` → opens the OS native folder dialog, returns `{ ok, path, cancelled? }`. macOS `osascript`, Windows PowerShell `FolderBrowserDialog`, Linux `zenity`→`kdialog`. Setup's Browse buttons. |
| `GET /api/images`            | Lists images in the configured input folder. |
| `GET /api/images/sample?n=`  | Random sample of n filenames (opening grid, Ghost/Stamp grids). Registered BEFORE `:filename`. |
| `GET /api/images/:filename`  | Streams one image. Path-traversal-safe. |
| `POST /api/export`           | `{ pngBase64 }` → writes `composition_YYYYMMDD_HHMMSS.png` to the output folder. |
| `POST /api/open-output`      | Reveals the output folder in the OS file manager. |
| `GET /api/ml/health`         | Sidecar health; answers `{ok:false}` fast (1.5 s timeout) when down. |
| `POST /api/ml/cutout` `/upscale` | Raw image bytes in → PNG bytes out (proxied to the sidecar; 503 when down). |

Backend patterns to follow: tilde expansion via `expandTilde`, path-traversal
safety (`path.basename()` + `startsWith` check), re-validate folders on every
request.

---

## 7. Build history and v2 progress

**v1 (complete, on `main`):** scaffold + folder setup + Fabric canvas +
deck reducer (phases 0–2); Add cards (3); the eight midgame/endgame card
phases (4–5) including export + finished screen; polish — card-flip
animation, keyboard shortcuts, saved thumbnail (6); card-set revision —
removed Vignette/Pencil, added Flip/Remove Layer/Shuffle/Zoom&Flatten (7);
layers-panel redesign with drag-to-reorder (8); tone cleanup. v1 taught us
what to keep (registry pattern, purity, commitment) and what failed
(add-card flooding, do-it-for-you cards, layer management) — see
`design_changes_july2.md`.

**v2 (in progress — update this table as phases land):**

| Phase | Status | What it ships |
|---|---|---|
| 0 — Plan lock + docs | ✅ done (2026-07-02) | Decisions locked, plan committed, this file rewritten. |
| 1 — deck.js v2 | ✅ done (2026-07-02) | New state machine, clickable end-to-end with stub cards. Coda / one-session stash return / grid 8+d8, pick 1+d3. |
| 2 — Bake engine + master raster | ✅ done (2026-07-02) | masterRaster.js (offscreen 2400×3000 truth, proxy view, universal bake, direct export); layers infra + 16 v1 card files deleted; @erase2d/fabric dropped. |
| 3a — The opening | ✅ done (2026-07-02) | Dice reveal, GridPicker overlay (thumbs, place/stash), placement.js free-transform sessions, /api/images/sample. |
| 3b — Erase brush core | ✅ done (2026-07-02) | brushCore.js: mask-based erase, hard/soft, undo/redo, Arrange/Erase toggle in placement sessions. |
| 4 — Effect-brush infra + Noise | ✅ done (2026-07-02) | Shared stroke engine + createRevealSession; Noise Brush card; generic card undo/redo via ctx.report. |
| 5 — Brush/global replication | ✅ done (2026-07-02) | effectCardFactory; Blur brush, HSV brush, Color Overlay, Global HSV, Reposition. 6 of 10 designs real. |
| 6 — Ghost | ✅ done (2026-07-02) | CardGridPicker single-pick grid; screen-blend placement + opacity/BC + erase; generic Overlay registry field; begin-awaits-user pattern. |
| 7 — ML sidecar | ✅ done (2026-07-02) | FastAPI on onnxruntime CPU-only; ESRGAN onnx committed in-repo; /api/ml proxy; start.js auto-start; degradation verified; README setup. |
| 8 — Stamp | ✅ done (2026-07-02) | Grid of 6 → rembg cutout via sidecar → place/opacity/erase; live degradation path; shared ArrangeEraseControls. |
| 9 — Deeper | ✅ done (2026-07-02) | 4:5-locked frame → master re-frame + true-detail ESRGAN restore; generic async commit hooks + Committing… state. |
| 10 — Rails | ✅ done (2026-07-02) | shatter.js most-shattered alpha cutout → solid color / opacity / erase; pure canvas2d, no sidecar. 10 of 10 designs real. |
| 11 — Tuning + polish | ⬜ (→ v3) | Pacing/deck balance, death-crop decision, tone pass, merge `v2`. Folded into the v3 redesign — see `version_3_design.md`. |

---

## 8. Live invariants worth knowing

- **Canvas orientation is fixed:** portrait, working view 800×1000, export
  2400×3000. In v2 the *master raster* (Phase 2) holds the true pixels at
  export resolution; the visible canvas is a scaled proxy. All bakes and ML
  passes happen at master resolution; export writes the master directly.
- **No session round-cap.** A session ends only when a death card is dealt.
  Pacing is tuned by deck composition + death-card count in `deck.js`.
- **The mask brush is a standing tool, not a card** (v3; grew out of v2's
  erase). Any time images are being placed (opening, stash return, Ghost,
  Stain, Stamp, Rails, Char), the conceal/restore/soften brush is available.
  Masks are image-native, so they travel with the image through
  move/scale/rotate.
- **Within-card undo/redo exists for brushes only, never across End.**
- **Global modifiers are banned except color adjustments**, which must carry
  an influence/opacity slider (Steep, Turn, Cure).
- **Color pickers start on a random hue every time.** Any control named
  `color` (Steep, Rails, and any future card) is seeded with a fresh
  random color when the card is dealt — its `defaultControls` value is only a
  placeholder. Randomization is centralized in `Editor.jsx`
  (`randomizeColors`, keyed on the control name `color`), so a new color card
  gets this for free just by naming its control `color`.
- **A card may own the viewport for its session** (Etch zooms to the
  master's grain), but it must restore the identity transform in both
  commit and cleanup — the universal bake snapshots through the CURRENT
  viewport (`toCanvasElement`), so a leaked zoom would bake wrong.
- **Browser tab dependency**: closing the tab loses in-progress work. By
  design — commitment is the mechanic.

---

## 9. Known issues / things to verify

- **v1's 3× export WebGL texture cap** (blank PNG on conservative devices):
  the Phase 2 master raster removed the multiplier *export*, but bakes still
  render at 3× — filter-heavy cards could hit texture caps at *bake* time.
  Verify on all three machines once the first filter card lands (Phase 4).
- ~~**`screen` blend + WebGL filters in Fabric 6**~~ — resolved in Phase 6
  by design: no v2 card uses Fabric's WebGL filters (Ghost/HSV/Blur redraw
  through 2d `ctx.filter` instead), and per-object
  `globalCompositeOperation` is confirmed to survive `toCanvasElement`
  bakes and export (Color Overlay + Ghost, verified on screen and in the
  exported PNG).
- **2d `ctx.filter` needs Safari 18+** — Blur brush, HSV brush/global, and
  Ghost's brightness/contrast silently no-op on older Safari. Fine on
  Chrome/Firefox/Edge. Add a pixel-loop fallback only if a machine needs it.
- **`xdg-open` on minimal Linux desktops** may be missing; `POST
  /api/open-output` fails silently and the path shown on screen is the
  fallback.
- **Native folder dialog on Linux** (`POST /api/pick-folder`, Setup's Browse
  buttons) needs **`zenity` or `kdialog`** installed. When neither is present
  the route returns `{ ok:false }` and Setup shows a note — typing the path by
  hand still works. macOS/Windows use built-in tooling (`osascript` /
  PowerShell). The macOS `choose folder` dialog can open *behind* the browser
  window; add `activate` to the AppleScript if that becomes annoying.
- **Filter flush race on End**: `canvas.renderAll()` is called immediately
  before snapshotting to flush filter pipelines. If a bake/export ever
  doesn't match the screen, investigate this timing first.
- **Sidecar cold start** (Phase 7+): models lazy-load on first call; the
  first Stamp/Deeper of a session will be slow. Communicate it in the UI,
  don't spinner-block the whole app.

---

## 10. How to run

```
npm run install:all     # first time only
npm run dev             # frontend :5173, backend :5174 (+ sidecar, Phase 7+)
```

Open <http://localhost:5173>. Setup screen prefilled from
`~/.deck-config.json`. Two absolute paths (input folder must exist with
images, output folder must be writable). Continue → Editor.

**Keyboard shortcuts** (Editor): **Space** = draw/deal, **Enter** = primary
action, **R** = restart. Suppressed while focus is in any form control.

---

## 11. Style notes for code

- Plain JavaScript everywhere. No TS. JSX files use `.jsx`.
- One file per card behavior, exporting its hooks AND its Tools component.
- `deck.js` stays pure forever. Never import Fabric or React there.
- Never add per-card branches to `Editor.jsx` or `DeckPanel.jsx`; extend the
  registry shape generically instead.
- Shared infrastructure (brush core, grid picker, bake engine) lives in its
  own module under `editor/`, imported by cards — not baked into Editor.
- Comments: only when the *why* isn't obvious. Don't narrate the *what*.
- React StrictMode is intentionally OFF — don't re-enable it.
- All user-facing copy obeys the §1 tone invariant.

---

## 12. How to add a new card (v2)

1. Design it as a *named chain* with freedom inside the constraint (§1). Add
   the card descriptor + copy count to the deck list in `deck.js`.
2. Create `frontend/src/editor/cards/<name>.jsx`. Build on the shared
   modules: brush core (erase/effect mode), grid picker, bake engine.
3. Add a registry entry in `cards/registry.jsx`.
4. Do not touch `Editor.jsx` / `DeckPanel.jsx`; extend the registry shape if
   needed.
5. Hand Stew browser test steps; wait for verification before commit.

### Where to start a fresh session

1. Read this file (you're here). §0 says where work stands.
2. Read `redesign_v2_plan.md` — the active plan.
3. Read `editor/deck.js` — the session rulebook.
4. Skim `cards/registry.jsx` and one card file near what you're building.
5. Check in with Stew before non-trivial work (§2). Build one unit,
   checkpoint, wait for "continue."
