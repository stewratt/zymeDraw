# CLAUDE.md — Deck (zymeDraw)

> Persistent context for any Claude Code session. Read it top-to-bottom
> before doing any work; keep §0 updated as work lands — it's the resume
> point. This file records what is *true now* and *how we work*; history
> lives in git and the design docs, never here.

---

## 0. Current state — resume here (updated 2026-07-06)

**`main` holds the complete v1 → v3 tool, verified by Stew.** The version
story lives in the design docs: `design_changes_july2.md` (v1 lessons),
`redesign_v2_plan.md` (v2: master raster + bake, brush core, ML sidecar),
`version_3_design.md` (v3: card system, zyme register, mask brush).

**Active work: v4, branch `v4` — the legible deck.** Read both v4 docs
first: `v4_design.md` (spec for card history + the standardized card
panel; built) and `v4_design_notes.md` (the randomness/control analysis
— **its §10 waves are the active plan**).

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

**Policy locked (notes §2): set-knowledge is free; order-knowledge and
order-control are never ambient** — the deal stays blind, the remains
stay unordered. Exceptions only as dealt/spent mechanics (Skim, Cull).

**Next actions (the notes' §10):** 1) Stew verifies Wave 2 in the
browser. 2) Playtest question (§7.2): does the splash-over tension
survive remains-knowledge + occasional order-control? 3) Wave 3 — the
descent experiment (§8.2): 1 Deeper dealt + 2 in reserve. 4) Later:
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

**The session arc** (v3 detail in `version_3_design.md`): opening pick
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
- Card names use the **zyme register**: one concrete process word (Silt,
  Bruise, Turn, Steep, Stain, Char, Cure), never a settings-menu label
  (`version_3_design.md` §4). Subliminal Etch is the one deliberate
  two-word exception.
- **No celebratory / gamer affect.** A piece is *finished*, not beaten.
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
  language, wait for "continue." The active plan's phases are the
  checkpoint map (today: `v4_design_notes.md` §10's waves).
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
├── design_changes_july2.md · redesign_v2_plan.md · version_3_design.md
├── v4_design.md · v4_design_notes.md    # v4 spec / ACTIVE PLAN (its §10)
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
  carry an influence slider (Steep, Turn, Cure).
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

1. Design freedom inside the constraint (§1); name it in the zyme
   register. Add the descriptor + copy count to `deck.js`.
2. Create `editor/cards/<name>.jsx` on the shared modules; add a
   registry entry. Don't touch `Editor.jsx` / `DeckPanel.jsx`.
3. Drop `assets/cards/<id>.png` (745×1040) — text face stands in until then.
4. Hand Stew browser test steps; wait for verification before commit.

### Where to start a fresh session

This file (§0 is the state) → `v4_design_notes.md` (§10 is the active
plan) + `v4_design.md` → `editor/deck.js` (the session rulebook) → skim
`cards/registry.jsx` and one nearby card file. Check in with Stew before
non-trivial work (§2): build one unit, checkpoint, wait for "continue."
