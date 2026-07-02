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

**Next action: Phase 4 — effect-brush infrastructure + Noise brush.**
The reveal pipeline (effected copy of the master, fully masked out,
painting reveals it), built on brushCore's stroke engine; first deck card
with real behavior. Riskiest canvas tech — verify bake fidelity and paint
performance at master resolution.

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

**The v2 session arc** (full detail in `redesign_v2_plan.md` §2.2):

1. **Opening rolls** — two dice-style rolls: how many images appear in a grid
   (8–16, sampled from the input folder), and how many you may pick (2–4).
2. **Opening pick** — choose your images; each is *placed now* or *stashed*
   for later. At least one placed.
3. **Placement** — arrange the placed images with move/scale/rotate and an
   always-available hard/soft **erase brush** (masking hard edges is core to
   collage; erase is a standing tool whenever images are placed, not a card).
4. **Act I** — deal ~4 modification cards from the shuffled deck.
5. **Stash return** — stashed images come back as a placement session.
6. **Act II** — ~2 more rounds, then death cards are shuffled into the
   remaining deck; keep dealing until one appears.
7. **Death card** — the piece is complete. Export at full resolution.

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
  finish, export, this round.* "Card," "deck," and dice-style rolls stay —
  they're the instrument, not a genre signal.
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
- **Planned (v2 Phase 7): Python 3 + FastAPI sidecar** hosting rembg
  (cutouts) and Real-ESRGAN (4× upscale). Auto-started by `npm run dev`,
  proxied by Express under `/api/ml/*`. CPU-only works; GPU accelerates.
  **Graceful degradation is a requirement**: the session never blocks on ML.
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
├── README.md                 # install/run instructions (gains Python setup in Phase 7)
├── design_changes_july2.md   # v2 design notes (source of truth for the why)
├── redesign_v2_plan.md       # v2 plan of attack (source of truth for the how)
├── package.json              # root: `concurrently` + scripts
├── frontend/
│   └── src/
│       ├── main.jsx          # React entry; StrictMode disabled by choice
│       ├── App.jsx           # top router: loading → setup → editor
│       ├── Setup.jsx         # folder-picker screen
│       └── editor/
│           ├── Editor.jsx       # registry dispatcher (no per-card logic!)
│           ├── CanvasStage.jsx  # Fabric canvas, forwarded ref
│           ├── DeckPanel.jsx    # right sidebar: per-phase panels + Tools + End
│           ├── deck.js          # PURE state machine — the v2 session script
│           ├── masterRaster.js  # offscreen 2400×3000 truth + universal bake
│           ├── editor.css
│           └── cards/
│               ├── registry.jsx # one entry per card (empty until Phase 3+)
│               └── pencil.jsx   # unregistered v1 reference for the brush core
└── backend/
    ├── server.js             # all Express routes (see §6)
    ├── config-store.js       # reads/writes ~/.deck-config.json
    └── ml/                   # PLANNED (Phase 7): FastAPI sidecar
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
| `GET /api/images`            | Lists images in the configured input folder. |
| `GET /api/images/:filename`  | Streams one image. Path-traversal-safe. |
| `POST /api/export`           | `{ pngBase64 }` → writes `composition_YYYYMMDD_HHMMSS.png` to the output folder. |
| `POST /api/open-output`      | Reveals the output folder in the OS file manager. |

**Planned for v2:**

| Route | Phase | Purpose |
|---|---|---|
| `GET /api/images/sample?n=` | 3 | Random sample of n filenames (opening grid, Ghost, Stamp grids). |
| `/api/ml/*` → sidecar proxy | 7 | `POST cutout` (rembg), `POST upscale` (Real-ESRGAN), `GET health`. |

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
| 4 — Effect-brush infra + Noise | ⬜ | Duplicate-mask-reveal pipeline, first effect brush. |
| 5 — Brush/global replication | ⬜ | Blur brush, HSV brush, Color Overlay, Global HSV, Reposition. |
| 6 — Ghost | ⬜ | Grid → screen-blend placement + opacity/BC + erase. |
| 7 — ML sidecar | ⬜ | FastAPI (rembg + ESRGAN), proxy, health, degradation, README setup. |
| 8 — Stamp | ⬜ | rembg cutout placement card. |
| 9 — Deeper | ⬜ | Crop/zoom/rotate re-frame + ESRGAN detail restore. |
| 10 — Rails | ⬜ | Palette-clamped alpha cutout stamp (prototype look first). |
| 11 — Tuning + polish | ⬜ | Pacing/deck balance, death-crop decision, tone pass, merge `v2`. |

---

## 8. Live invariants worth knowing

- **Canvas orientation is fixed:** portrait, working view 800×1000, export
  2400×3000. In v2 the *master raster* (Phase 2) holds the true pixels at
  export resolution; the visible canvas is a scaled proxy. All bakes and ML
  passes happen at master resolution; export writes the master directly.
- **No session round-cap.** A session ends only when a death card is dealt.
  Pacing is tuned by deck composition + death-card count in `deck.js`.
- **Erase is a standing tool, not a card.** Any time images are being placed
  (opening, stash return, Ghost, Stamp), the hard/soft erase brush is
  available.
- **Within-card undo/redo exists for brushes only, never across End.**
- **Global modifiers are banned except color adjustments**, which must carry
  an influence/opacity slider.
- **Browser tab dependency**: closing the tab loses in-progress work. By
  design — commitment is the mechanic.

---

## 9. Known issues / things to verify

- **v1's 3× export WebGL texture cap** (blank PNG on conservative devices):
  the Phase 2 master raster removed the multiplier *export*, but bakes still
  render at 3× — filter-heavy cards could hit texture caps at *bake* time.
  Verify on all three machines once the first filter card lands (Phase 4).
- **`screen` blend + WebGL filters in Fabric 6** (Ghost card): verify
  `toDataURL` respects `globalCompositeOperation` when filters are active on
  the same object. Spike scheduled in Phase 6.
- **`xdg-open` on minimal Linux desktops** may be missing; `POST
  /api/open-output` fails silently and the path shown on screen is the
  fallback.
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
