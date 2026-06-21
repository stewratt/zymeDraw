# CLAUDE.md — Deck (zymeDraw)

> This file is the persistent context for any Claude Code session in this repo.
> Read it top-to-bottom before doing any work. It captures the invariants and
> architectural decisions of a project that is now feature-complete.

---

## 1. The project

**Deck** is a Photoshop-like browser image editor whose workflow is driven by
*drawing cards from a deck.* Each card constrains the UI to exactly one tool,
the user performs that one action on a canvas, then presses **End** —
which commits the action permanently and draws the next card.

**Core philosophy: destructive, commitment-based.** There is no global
undo/redo across committed steps. The point is to force a choice and bake
it in. Commitment is the central mechanic, not a missing feature.

The deck moves through three phases (beginning → midgame → endgame) so a
composition has a natural arc: things are added, then modified, then
finished and exported to disk at 2400×3000.

---

## 2. Working agreement (do not violate)

The user (Stewart, "Stew") is **not a programmer by trade.** They use git
and VS Code, can read JS/Python, but cannot write code from scratch. They
explicitly want to *understand* the architecture as the project grows, not
just receive working code they can't maintain.

**These are non-negotiable unless the user changes them in-session:**

- **Build in phases, stop at every checkpoint.** When new work is added
  (a new card, a Phase 7+ feature), implement one unit at a time, summarize
  what was built, explain the *one* key concept it introduced in plain
  language, then wait for "continue." (The original build is done — this
  rule applies to future additions.)
- **Before any non-trivial implementation, check in first.** If a step
  needs a clever or unfamiliar technique, pause and present the options
  before coding. Use `AskUserQuestion` if it helps make the choice
  concrete.
- **Keep code small and readable.** Comment the non-obvious parts only.
  Boring/idiomatic > clever.
- **No no-code shortcuts. No global undo/redo across commits.** Within a
  single card the user can adjust freely (nothing is committed yet); after
  End it is irreversible. This is by design.
- **Verify current library APIs before using them.** Fabric.js has changed
  its drawing/eraser/filter APIs across major versions. We target Fabric 6.x.
  When new functionality lands, check the actual installed version's API
  rather than guessing.
- The user does not run code on Claude's behalf unless asked. **Claude
  writes code; the user verifies in the browser.** If something needs
  testing in the UI, hand the user clear test steps and wait.

**Cross-machine setup.** The repo is cloned to:
- Linux (Arch) — primary, `/home/stewrat/`
- Mac laptop — `/Users/stewartbird/`
- Windows — `C:\Users\birds\`

Never hardcode input/output folder paths. They're chosen at runtime in the
Setup UI and persisted to `~/.deck-config.json` per machine.

---

## 3. Tech stack

- **Frontend**: Vite 5 + React 18 + **Fabric.js 6.x** for the canvas, layers,
  filters. Plain JavaScript (no TypeScript). React `StrictMode` is
  *intentionally disabled* in `main.jsx` because Fabric doesn't tolerate the
  double-effect dev behavior.
- **`@erase2d/fabric`** — Fabric v6 removed `EraserBrush` from core; this is
  the maintainer-blessed replacement. Used only by the Eraser card. API
  differs slightly from old Fabric: `eraser.on('end', handler)` returns a
  *disposer* function (not `eraser.off(...)`), and you must call
  `e.preventDefault()` + `await eraser.commit({path, targets})` to make the
  stroke destructive — otherwise it's just a non-destructive clipPath.
- **Backend**: Node 20+ + Express 4. Read/serve images, write the export PNG,
  reveal the output folder in the OS file manager, remember last-used folder
  paths. The backend does no game logic.
- **Communication**: plain REST on localhost. Vite proxies `/api/*` → Express
  on port 5174. No CORS in dev. JSON body limit raised to 64 MB to hold one
  2400×3000 base64-encoded export.
- **Dev runtime**: `npm run dev` at repo root uses `concurrently` to run
  both servers; first-time install is `npm run install:all`.

**Architectural invariant: frontend = brain, backend = hands.** The deck
state machine, canvas logic, card behavior all live in React. Express
exists *only* because the browser sandbox can't touch the filesystem. If
new functionality doesn't touch a file, it doesn't belong in the backend.

---

## 4. Repo layout

```
zymeDraw/
├── CLAUDE.md                 # this file
├── README.md                 # install/run instructions for the user
├── package.json              # root: just `concurrently` + scripts
├── .gitignore
├── frontend/
│   ├── package.json          # fabric, @erase2d/fabric, react, react-dom, vite
│   ├── vite.config.js        # /api → :5174 proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx          # React entry; StrictMode disabled by choice
│       ├── App.jsx           # top router: loading → setup → editor
│       ├── App.css           # global + setup screen styles
│       ├── Setup.jsx         # folder-picker screen
│       └── editor/
│           ├── Editor.jsx       # registry dispatcher (no per-card logic!)
│           ├── CanvasStage.jsx  # Fabric canvas, forwarded ref
│           ├── DeckPanel.jsx    # right sidebar: card face + Tools + SESSION COMPLETE
│           ├── LayersPanel.jsx  # layers UI: 'slot' or 'target' mode
│           ├── deck.js          # PURE state machine — never imports DOM/Fabric
│           ├── layers.js        # getCommittedLayers(canvas) helper
│           ├── editor.css       # editor + per-tool styles + card-flip animation
│           └── cards/
│               ├── registry.jsx    # one entry per card
│               ├── addCard.jsx     # Add 1/2/3
│               ├── pencil.jsx      # 4.1
│               ├── eraser.jsx      # 4.2 — uses @erase2d/fabric
│               ├── flatten.jsx     # 4.3
│               ├── hsv.jsx         # 4.4
│               ├── blur.jsx        # 4.5
│               ├── grain.jsx       # 4.6
│               ├── grade.jsx       # 4.7
│               ├── vignette.jsx    # 5 endgame
│               ├── frame.jsx       # 5 endgame
│               ├── finalGrade.jsx  # 5 endgame
│               └── grainFinish.jsx # 5 endgame
└── backend/
    ├── package.json          # only `express`
    ├── server.js             # all routes (see §6)
    └── config-store.js       # reads/writes ~/.deck-config.json
```

The config file `~/.deck-config.json` lives in the user's home directory,
NOT the repo. Each machine has its own.

---

## 5. The two patterns that hold everything together

### 5.1 The deck state machine (in `editor/deck.js`)

`deck.js` is a **pure reducer**. It has no knowledge of Fabric, the DOM,
the canvas, or any side effect. Anyone reading it should be able to
understand the entire game in two minutes.

State shape:
```js
{
  phase: 'BEGINNING' | 'MIDGAME' | 'ENDGAME_DRAWN',
  midgameRounds: number,         // commits since beginning round
  endgameThreshold: number,      // picked once per session, 3-5
  currentCard: Card | null,
  history: [{ cardId, kind, ts }, ...]
}
```

Actions:
- `DRAW`   — samples uniformly from `eligiblePool(state)`. Draw with replacement.
- `COMMIT` — appends to history, clears currentCard, advances phase/counter.
  An endgame card commit → `ENDGAME_DRAWN` (terminal).
- `RESTART` — back to a fresh initial state with a re-rolled threshold.

Eligible pool by phase:
- BEGINNING       → adds only (3 cards). Beginning is exactly 1 round.
- MIDGAME, locked → adds + midgame (10).
- MIDGAME, unlocked → adds + midgame + endgame (14). Unlocks when
  `midgameRounds >= endgameThreshold`.

Card sets (in `deck.js`):
- ADD_CARDS:     `add1`, `add2`, `add3` (count=1,2,3)
- MIDGAME_CARDS: `pencil`, `eraser`, `flatten`, `hsv`, `blur`, `grain`, `grade`
- ENDGAME_CARDS: `vignette`, `frame`, `finalGrade`, `grainFinish`

### 5.2 The card registry (in `editor/cards/registry.jsx`)

`Editor.jsx` doesn't know what any specific card does. It looks up
`cardRegistry[currentCard.id]` and calls lifecycle hooks. Adding a new
card = ONE new entry + ONE behavior file. **Do not add per-card branches to
Editor.jsx or DeckPanel.jsx.**

Registry entry shape:
```js
{
  controls: ['size', 'color'],        // names of controls (used by per-card Tools)
  defaultControls: { ... },           // initial values
  needsLayersPanel: true,
  layersPanelMode: 'slot' | 'target',
  layerKinds: ['image'],              // OPTIONAL: filter layer picker by kind
  Tools: ReactComponent,              // rendered inside DeckPanel's tool-area
  begin?: async (ctx) => session,     // runs when card is drawn
  update?: (ctx) => void,             // runs whenever a control changes
  commit?: (ctx) => void,             // runs on End — destructive
  cleanup?: (ctx) => void             // runs if card is abandoned (restart)
}
```

`layerKinds` was added so Eraser/HSV/Blur could restrict the target
picker to image layers only. Editor.jsx applies it generically — it is
NOT a per-card branch.

The `ctx` object passed to hooks:
```js
{
  canvas,                  // Fabric Canvas instance
  controls,                // current control values
  layers,                  // getCommittedLayers(canvas) result
  imageList,               // filenames from /api/images
  canvasWidth, canvasHeight,
  session,                 // whatever begin returned (commit/update only)
  report                   // (patch) => merges into cardInfo state for UI
}
```

**Committed-object tagging.** Any object placed on the canvas as part of
a real commit MUST be tagged so the Layers panel can find it:
```js
fabricObj.deckId = unique
fabricObj.deckLabel = 'human-readable label'
fabricObj.deckKind = 'image' | 'draw' | 'group' | ...
```
`getCommittedLayers(canvas)` filters by `obj.deckId`.

---

## 6. Backend API

| Route | Purpose |
|---|---|
| `GET /api/ping`              | Sanity check `{ ok: true }`. |
| `GET /api/config`            | Returns `{ inputFolder, outputFolder, homedir }`. |
| `POST /api/config`           | Validates both paths (read for input, write for output). Persists `~/.deck-config.json` if both ok. Returns per-field errors otherwise. |
| `GET /api/images`            | Lists `.png/.jpg/.jpeg/.webp` in the configured input folder. |
| `GET /api/images/:filename`  | Streams a single image. Path-traversal-safe (`basename` + startsWith check). |
| `POST /api/export`           | Accepts `{ pngBase64 }`, decodes, writes `composition_YYYYMMDD_HHMMSS.png` to the output folder. Returns `{ ok: true, savedPath }`. |
| `POST /api/open-output`      | Reveals the configured output folder in the OS file manager (`open` / `explorer` / `xdg-open`). Detached + unref'd so the file manager outlives the request. |

The validator expands `~/Pictures/foo` to the absolute home path. It
requires the folder to exist (no auto-create).

---

## 7. What's built

| Phase | Status | What it shipped |
|---|---|---|
| 0 — Scaffold | ✅ done | Vite+React frontend, Express backend, dev workflow (`npm run dev`), `/api/ping`. |
| 1 — Folder selection + I/O | ✅ done | Setup screen, config endpoints, image listing, image serving. |
| 2 — Canvas + loop shell | ✅ done | Fabric canvas (800×1000), `deck.js` reducer, debug badge, placeholder cards. |
| 3 — Add cards | ✅ done | Add 1/2/3: random sample without replacement, place scaled+staggered, move/scale/rotate, End locks. |
| 4.1 — Pencil | ✅ done | Card registry pattern introduced. Pencil with `fabric.PencilBrush`, layers slot-picker, group-on-commit, locked draw layers. |
| 4.2 — Eraser | ✅ done | `@erase2d/fabric` EraserBrush; image-layers-only target; per-stroke destructive commit. |
| 4.3 — Flatten | ✅ done | Async `begin` pre-renders the flattened image so `commit` is sync. |
| 4.4 — Layer HSV | ✅ done | `HueRotation` + `Saturation` + `Brightness` filters appended to the chosen image; switching targets reverts the previous one. |
| 4.5 — Layer Blur | ✅ done | Single `Blur` filter, same pattern as HSV. |
| 4.6 — Canvas Grain | ✅ done | Random-per-draw noise overlay. |
| 4.7 — Color Grade | ✅ done | Six presets, per-layer `ColorMatrix`. Pencil/draw layers excluded (MVP limitation, accepted). |
| 5 — Endgame + export | ✅ done | Four endgame cards (Vignette, Frame, Final Grade, Grain Finish), `POST /api/export`, SESSION COMPLETE screen. |
| 6 — Polish | ✅ done | Card-flip animation, keyboard shortcuts (Space=Draw, Enter=primary, R=Restart), saved-thumbnail in SESSION COMPLETE, "Open output folder" button (`POST /api/open-output`). |

---

## 8. Stretch ideas (only if the user asks)

These are out of scope as of the original spec and were *not* implemented.
Treat each as its own mini-project:

- **Smudge brush** — a midgame card that smears existing pixels.
- **Localized brushes** — restrict pencil/eraser to a per-target mask.
- **Real `.cube` LUTs** — replace the preset `ColorMatrix` swatches in
  Color Grade and Final Grade with cube-file parsing + 3D LUT sampling.
- **Graphical folder browser** in Setup — currently the user types/pastes
  absolute paths. A `<input type="file" webkitdirectory>` would help, but
  browser security limits the actual path information that comes back.
- **Setup screen UX pass** — auto-validate paths as the user types
  (debounced), clearer per-field error display. Lower priority than the
  others because it's only first-time friction.
- **Smudge/blend modes for the grain overlay** — currently the noise
  layer is a straight alpha overlay; could be `screen` or `overlay`.

---

## 9. Pending decisions (historical record)

All §9 decisions were resolved during the original build. Kept here as a
record of what was decided and why:

| Decision | Outcome | Resolved at |
|---|---|---|
| Eraser target | image layers only; pencil has no eraser sub-mode | Phase 4.2 |
| Pencil stack insertion | "Draw on top, group on End" | Phase 4.1 |
| Color Grade behavior | per-layer `ColorMatrix`; draw layers excluded as MVP limitation | Phase 4.7 |
| Canvas orientation | portrait 800×1000 → export 2400×3000 | Phase 0 |
| Canvas Grain seed | random per draw (matches "chance is part of the game") | Phase 4.6 |
| Endgame cards | four distinct finishing effects | Phase 5 |
| End-rate (pool composition) | kept at 4 endgame in pool of 14 (~28% per draw); to be re-evaluated after extended play | Phase 5 |
| Safety round-cap | none — session can theoretically run forever | Phase 5 |

If extended play later suggests sessions end too fast or too slow, the
end-rate is tuned by editing the `ENDGAME_CARDS` array in `deck.js`
(append placeholders to slow it; remove to speed it). No code change
elsewhere needed.

---

## 10. Known issues / things to verify

- **Fabric Group coordinate behavior on Pencil commit.** Has not been
  systematically stress-tested. If strokes ever "jump" position on End,
  the fix is to either pass explicit `left/top` from the bounding box,
  set `subTargetCheck: true`, or compute coords manually before
  constructing the Group.
- **Browser tab dependency**: closing the tab loses any in-progress card.
  By design — commitment is the mechanic.
- **3× export and WebGL texture size limits.** `canvas.toDataURL({ multiplier: 3 })`
  upsamples the working 800×1000 canvas to 2400×3000. On devices with
  conservative WebGL texture caps this can return a black or empty PNG.
  Symptom: the saved file is blank. Fallback: drop multiplier to 2
  (1600×2000) or render in tiles.
- **`xdg-open` on minimal Linux desktops.** If not installed, the spawn
  in `POST /api/open-output` errors out (the request still returns 200
  because the error handler is no-op). The path is shown on screen as a
  fallback so the user can navigate manually.
- **Filter flush race on End.** The Editor's export `useEffect` calls
  `canvas.renderAll()` immediately before `toDataURL` to force the filter
  pipeline to flush. If saved exports ever don't match what was on screen,
  the cause is almost certainly here — investigate the timing of the
  final render.

---

## 11. How to run

```
npm run install:all     # first time only
npm run dev             # frontend on :5173, backend on :5174
```

Open <http://localhost:5173>. Setup screen prefilled from
`~/.deck-config.json`. Type or paste two absolute paths (input folder must
exist with images, output folder must be writable). Continue → Editor.

**Keyboard shortcuts** (Editor only):
- **Space** — Draw card (when no card is active)
- **Enter** — primary action (Draw / End / Restart depending on phase)
- **R** — Restart anytime

Shortcuts are suppressed when focus is in an input, color picker, range
slider, or text field.

---

## 12. Style notes for code

- Plain JavaScript everywhere. No TS.
- Files containing JSX use `.jsx`, files without use `.js`.
- One file per card behavior. Each exports its behavior functions AND its
  React Tools component.
- `deck.js` stays pure forever. Never import Fabric or React there.
- Never add per-card branches to `Editor.jsx` or `DeckPanel.jsx`. If a new
  card needs something they can't express today, extend the registry
  shape — don't special-case. (`layerKinds` is the prototype for this:
  generic, opt-in, one line of Editor logic.)
- Tag every committed Fabric object with `deckId / deckLabel / deckKind`.
- Comments: only when the *why* isn't obvious. Don't narrate the *what*.
- React StrictMode is intentionally OFF — don't re-enable it.

---

## 13. How to add a new card or feature

The original phased build is complete. If you want to add something new:

### Adding a new card

1. Decide where it fits: `add` (beginning), `midgame`, or `endgame`. Add
   the card descriptor to the corresponding array in `deck.js`.
2. Create `frontend/src/editor/cards/<name>.jsx`. Use `pencil.jsx` as the
   reference for a midgame card with controls; `flatten.jsx` for one with
   no controls; `vignette.jsx` for an endgame card with an overlay.
3. Add a registry entry in `cards/registry.jsx` pointing at your new
   file's exports.
4. **Do not touch `Editor.jsx` or `DeckPanel.jsx`.** If your card needs
   something the registry shape can't express, extend the *shape* with
   another optional field (like `layerKinds` was added) — Editor applies
   it generically.

### Adding a new feature that touches the filesystem

Backend route in `backend/server.js`. Follow the existing patterns:
- Tilde expansion via `expandTilde`.
- Path-traversal safety: `path.basename()` + `resolved.startsWith(root)`.
- Re-validate folders on every request (don't trust persisted config).

### Where to start a fresh session

1. Read this file (you're here).
2. Read `editor/deck.js` — two minutes, the entire rulebook.
3. Read `editor/cards/registry.jsx` — confirms the plug-in shape.
4. Skim one existing card file matching what you're about to build.
5. Ask the user what they want to add. Check in before non-trivial work
   (see §2). Build one unit, checkpoint, wait for "continue."
