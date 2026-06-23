# CLAUDE.md — Deck (zymeDraw)

> This file is the persistent context for any Claude Code session in this repo.
> Read it top-to-bottom before doing any work. It captures the invariants and
> architectural decisions of a project in active iteration.

---

## 0. Current state — resume here (paused 2026-06-23)

**Phase 8 (Layers panel redesign) is code-complete and the frontend builds
clean, but two things are still open — do these first:**

1. **Not yet browser-verified.** Stew hasn't run the Phase 8 test steps in the
   UI. Verify before committing:
   - Draw **Add 2 / Add 3** → drag rows in the Layers panel → canvas stacking
     should follow live, and the order should persist after End.
   - Draw **Eraser / HSV** → those panels unchanged (no drag handles).
   - Draw **Shuffle** → the read-only stack list should track each "Shuffle
     again" reroll with no one-click lag.
   - Stack 10+ layers → panel still scrolls and the End button stays visible.
2. **Nothing is committed.** All Phase 8 code changes *and* the recent CLAUDE.md
   edits are uncommitted on `main`. Once verified, **branch off `main`** and
   commit — do not commit straight to `main`.

Phase 8 touched: `Editor.jsx` (added `cardReady` to the `committedLayers` effect
deps), `LayersPanel.jsx` (new `reorder` + `display` modes), `cards/addCard.jsx`
(`applyLayerOrder` + `updateAddCard`), `cards/registry.jsx` (Add + Shuffle
entries), `editor.css` (drag styles). Details in §7, row 8.

**After Phase 8 is verified + committed, next work (Stew picks):**
- **Tone cleanup (small, recommended next).** Apply the new §1 "not a game"
  invariant to existing UI copy — "SESSION COMPLETE", "Draw card", the
  keyboard-shortcut labels, any gamey card names. Bite-sized; fits what was just
  decided.
- **Phase 9 — brush cards (large, research-first).** See §14. Starts with
  research + the masked-bake vs. non-destructive architecture decision, not code.

> Delete this §0 once Phase 8 is committed and the resume notes are stale.

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

### Tone — this is not a game (macro design invariant)

Deck is an **artmaking tool**, not a game. It *borrows* game theory and game
design — a deck, drawing, phases, randomness, commitment — purely as a way to
impose **constraint** on a creative process. That is the whole reason the
mechanics exist. But the experience must never *present* as a game.

- **Language is a studio/darkroom/press, not an arcade.** Avoid "play," "win,"
  "score," "points," "level," "player," "turn," "move," "you drew a card!"
  Prefer neutral, creative-tool verbs: *draw, commit, compose, finish, export,
  the stack, this round.* "Card" and "deck" stay — they're the instrument, not
  a genre signal.
- **No celebratory / gamer affect.** No score-ups, win-states, streaks, or
  congratulatory copy. The endgame is a piece being *finished*, not a level
  being *beaten*.
- **Apply this to everything user-facing:** UI copy, button labels, card names,
  empty/complete states, and the names of anything new. When in doubt, ask
  "would this read as a serious creative instrument, or as a game?" and pick the
  former.

The mechanics are game-derived; the *framing* is a tool. Hold that line. (Some
existing copy still leans gamey — e.g. "SESSION COMPLETE", "Draw card" — and
should be eased back toward this tone when those surfaces are next touched.)

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
│               ├── pencil.jsx      # 4.1 — RETAINED as brush base; removed from draw pool (Phase 7)
│               ├── eraser.jsx      # 4.2 — uses @erase2d/fabric
│               ├── flatten.jsx     # 4.3
│               ├── hsv.jsx         # 4.4
│               ├── blur.jsx        # 4.5
│               ├── grain.jsx       # 4.6
│               ├── grade.jsx       # 4.7
│               ├── frame.jsx       # 5 endgame
│               ├── finalGrade.jsx  # 5 endgame
│               ├── grainFinish.jsx # 5 endgame
│               ├── flip.jsx        # 7 — Flip Canvas Horizontal (preserves layers)
│               ├── removeLayer.jsx # 7 — Remove 1 Layer (target picker, all kinds)
│               ├── shuffle.jsx     # 7 — Shuffle Layer Order
│               └── zoomFlatten.jsx # 7 — Zoom & Flatten (flatten + random 30–50% zoom)
│               # NOTE: vignette.jsx was DELETED in Phase 7.
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

Eligible pool by phase (counts as of Phase 7):
- BEGINNING       → adds only (3 cards). Beginning is exactly 1 round.
- MIDGAME, locked → adds + midgame (3 + 10 = 13).
- MIDGAME, unlocked → adds + midgame + endgame (3 + 10 + 3 = 16). Unlocks when
  `midgameRounds >= endgameThreshold`.

Card sets (in `deck.js`) — current as of Phase 7:
- ADD_CARDS:     `add1`, `add2`, `add3` (count=1,2,3)
- MIDGAME_CARDS: `eraser`, `flatten`, `hsv`, `blur`, `grain`, `grade`,
  `flip`, `removeLayer`, `shuffle`, `zoomFlatten`
  (`pencil` was removed from the pool in Phase 7 but its file/registry entry
  are retained as the base for the upcoming brush cards)
- ENDGAME_CARDS: `frame`, `finalGrade`, `grainFinish`
  (`vignette` was removed in Phase 7)

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
| 7 — Card-set revision | ✅ done | **Removed:** Vignette (deleted) + Pencil (un-pooled, code retained). **Fixed:** layers-panel overflow no longer covers the End button (`deck-panel` pinned `flex-shrink:0`, layer stack scrolls in a bounded `min-height:0` region). **Added 4 midgame cards:** Flip Canvas (mirrors each layer individually — preserves layers), Remove Layer (target picker, any kind, live hide-preview), Shuffle Layers (random stack permutation + "Shuffle again" reroll), Zoom & Flatten (flatten then random 30–50% center zoom; fixed canvas crops = the "trim"). |
| 8 — Layers panel redesign | ✅ done | **Drag-to-reorder on Add cards** (native HTML5 DnD, no new deps): new `reorder` panel mode owns its local top-down order and persists it to `controls.layerOrder`; the Add `update` hook applies it to the canvas via `applyLayerOrder` (reverse-then-`moveObjectTo`, mirroring `shuffle.jsx`). One generic Editor fix: `committedLayers` now refreshes on `cardReady` too, so a card sees the layers its `begin` just placed (filtered by `deckId`, so it's safe for all cards). **Read-only `display` mode** mirrors the live stack for Shuffle, re-reading canvas order one `requestAnimationFrame` after each reroll to dodge child-before-parent effect ordering. Effect/target cards unchanged. |

> **Next up (not yet built):** Phase 9 = Brush cards (§14, research-first). Its standalone prompt is at the bottom of this file so it can be run in a fresh context.

---

## 8. Stretch ideas & design considerations (only if the user asks)

Out of scope as of the original spec. Treat each as its own mini-project.
(Smudge brush and localized/masked brushes were here too — both promoted into
Phase 9, see §14.)

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

### Conditional / weighted draws (roguelike-derived) — consider, don't build yet

Today `DRAW` samples **uniformly, with replacement** from `eligiblePool`. A
future direction worth weighing: make the deck *opinionated*, so a drawn card
reshapes the odds of others — e.g. pulling **Flatten** lowers the chance of
**Shuffle Layers** next (less stack to shuffle), or certain cards become more
likely after others to create a coherent arc.

This is a **game-design decision to make deliberately, not drift into.** The
open question: should the system *rail* the experience this way (smoother arcs,
fewer dead-end/no-op states), or stay neutral and let absurd or "broken"
sequences happen as a legitimate outcome of working under constraint? Both are
defensible; current lean is **toward allowing breakage** unless extended use
shows it genuinely harms the work. (Note: per §1, even if we add this, frame it
as constraint/serendipity — *not* as roguelike "runs" or "difficulty.")

If built, it lives **entirely in `deck.js`** (weighting inside `eligiblePool` /
the sampler). That file stays pure — no Fabric, no side effects.

---

## 9. Live invariants worth knowing

The original build resolved a long list of design questions; most are now just
*how the thing works* and aren't worth re-listing. The few that are still live
knobs or non-obvious constraints:

- **Canvas orientation is fixed:** portrait 800×1000 working → 2400×3000 export.
  Not configurable without a deliberate reason (see also the export texture-size
  caveat in §10).
- **No safety round-cap.** A session can run indefinitely; it ends only when an
  endgame card commits.
- **End-rate has one tuning point.** It's the size of `ENDGAME_CARDS` relative to
  the rest of the pool in `deck.js` (~28% per draw once unlocked). Append
  placeholders to slow endings, remove to speed them — no other code changes.
  This is also the natural home for the weighted-draw idea in §8.
- **Color Grade excludes draw layers** (per-layer `ColorMatrix`, image layers
  only) — an accepted MVP limitation, not a bug.

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
   no controls; `frame.jsx` for an endgame card with an overlay; `flip.jsx`
   / `shuffle.jsx` / `zoomFlatten.jsx` (Phase 7) for recent, minimal examples.
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

---

## 14. Phase 9 prompt — Brush cards (research, then build)

> Paste this whole section as the opening prompt of a fresh context. This phase
> is RESEARCH-FIRST. Do not write feature code until the research + the one
> architecture decision below are settled with the user. Obey §2 throughout.

**Goal (from `card_changes.txt`).** Turn effects into brushes:
- A **soft round** brush option (currently only Fabric's hard-edged
  `PencilBrush`), selectable on any card that uses a brush.
- New **effect-brush cards**, Affinity-style: HSV brush, brightness/contrast
  brush, blur brush, noise brush, **smudge** brush — paint the effect locally
  instead of applying it to a whole layer.
- A **liquify / grid-warp** card (Procreate-style) — macro mesh pulling of the
  canvas like a grab tool. (Hardest item; do last.)

`pencil.jsx` (retained, un-pooled) is the brush base to build on.

**THE architecture decision to settle first (use `AskUserQuestion`).**
`card_changes.txt` asks for effects "done as an adjustment layer, which can be
re-positioned in the layer stack." A true **non-destructive, repositionable
adjustment layer that composites through the stack** is NOT something Fabric 6
does natively, and it conflicts with the project's destructive/commitment
philosophy (§1). Two viable paths — present both, recommend the first:
  - **(A) Destructive masked bake (recommended).** The user paints a grayscale
    mask on a chosen target layer; on End, render the target, apply the effect
    (Fabric filter, or pixel op for smudge) to a copy, and composite the
    filtered pixels back through the mask into the target's pixels — replacing
    the target image, destructively. Fits the philosophy, achievable in Fabric
    today, and every effect brush becomes "the same masking infra + a different
    effect." This is the recommended foundation.
  - **(B) True non-destructive adjustment layers.** Repositionable adjustment
    objects that filter everything beneath them. Requires a custom compositing
    pipeline (likely a WebGL layer / different engine) — a large architectural
    change. Only pursue if the user explicitly wants non-destructive.

**Research to do BEFORE coding (use WebSearch/WebFetch; verify against the
INSTALLED version — check `frontend/package.json`, we target Fabric 6.x):**
- Fabric 6 custom brush API: how to subclass `PencilBrush` / `BaseBrush`,
  and the current soft-edge options (shadow/`limitedToCanvasSize`/stamped
  radial-gradient dabs). Confirm the real v6 method names.
- Canvas2D masked compositing (`globalCompositeOperation`,
  `getImageData`/`putImageData`) for the "bake effect through a painted mask"
  step in path (A).
- Smudge technique: per-`pointermove` grab-and-stamp with offset + partial
  alpha (this and "localized brushes" were §8 stretch ideas — now in scope).
- Liquify: evaluate libraries/techniques for browser mesh warp —
  glfx.js, pixi.js (mesh/displacement filter), regl, three.js, or a
  displacement-map shader. Decide whether to render warp to an offscreen
  canvas and bake the result back as a Fabric `image` layer (keeps the rest of
  the architecture intact). Report options with trade-offs and let the user pick.

**Recommended build order (one card per checkpoint, smallest first):**
1. **Soft round brush option** — a reusable hard/soft brush-shape control +
   custom soft brush. Wire it into a brush card first; it also produces the
   soft-edged masks the effect brushes need.
2. **One effect brush as the masking-infra prototype** — suggest
   brightness/contrast (simplest filter). Build the generic "paint mask → bake
   effect through mask on End" infra here so the rest are small.
3. **Replicate** for HSV brush, blur brush, noise brush (each = infra + one
   filter, one small file + one registry entry).
4. **Smudge brush** — custom pixel-grab brush.
5. **Liquify / grid warp** — last, per chosen library.

Keep each effect brush a single small file + one registry entry, mirroring the
plug-in philosophy (§5.2, §12). Add new cards to `MIDGAME_CARDS` in `deck.js`.
**Do not touch `Editor.jsx` / `DeckPanel.jsx`** — extend the registry shape if a
card needs something new (e.g. a shared `brushShape` control), exactly as
`layerKinds` did.

**Test steps:** hand the user per-card UI test steps as each brush lands; for
masked-bake brushes, verify the effect appears only where painted and that End
bakes it destructively into the target layer (re-drawing the same card should
see the baked result, not a live filter).
