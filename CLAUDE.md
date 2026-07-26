# CLAUDE.md — Deck (zymeDraw)

> Persistent context for any Claude Code session; read top-to-bottom first.
> This file holds *rules and structure* — it changes when a rule changes,
> never when work lands. State lives in GitHub (issues, PRs, git log);
> design rationale in the plan docs; history never lives here.

## 0. State & routing — resume here

- **The backlog is GitHub issues** (`stewratt/zymeDraw`), labeled by line
  (`card-line` / `infra` / `foundry`) and size. Browse: `gh issue list`.
- **Workflow**: pick an issue → branch off `main` (per issue) → build in
  checkpoints, Stew verifies in the browser on the branch → PR, "Closes
  #N". `size:S` = direct commit, no ceremony. Parent issues are
  checklists; `parked` issues get no branch until promoted.
- **Built-but-unverified work lives in issue #17** — the only ledger for
  awaiting-browser-check state.
- **Design rationale**: `to_do/cards_plan.md` (card line: Kid Pix cards +
  deck builder) · `to_do/app_plan.md` (infra line: ZYME shell, packaging,
  the stream). Each plan's §7 waves are the checkpoint map; §8 lists the
  questions Stew still owes. v1–v4 story: `archive/` + git log.

## 1. The project

**Deck** is a browser tool for digital collage driven by *drawing cards
from a deck*. Each card constrains the UI to exactly one action; the user
works within that constraint, then **draws from the deck**, which commits
the result permanently and deals the next card.

**Core philosophy: destructive, commitment-based.** No undo across
committed steps; every End flattens the canvas to a single image.
Commitment is the central mechanic, not a missing feature.

**The session arc**: opening pick (take two — strictly one *placed*, one
*stashed*) → placement (move/scale/rotate + standing mask brush) → Act I
(~4 mod cards) → stash return → Act II (death cards shuffle in; deal until
one appears) → the **Coda**: complete, export at full resolution.

**Card design rule: constraint outside, freedom inside.** No card simply
*does something to the image* — a blur is a brush you compose with, not a
filter that happens to you.

**Foundry** is the second wing of the same shell (spec: `card_maker.md`):
deck-driven meta-sessions that cast the card faces themselves.

### Tone — this is not a game (macro design invariant)

Deck is an **artmaking tool** that borrows game design purely to impose
constraint; it must never *present* as a game. This governs every name,
label, state, and line of user-facing copy:

- **Studio/darkroom/press language, not arcade.** Avoid "play," "win,"
  "score," "level," "player," "turn." Prefer *draw, deal, commit, compose,
  finish, export, this round.* "Card" and "deck" stay.
- Card names use the **zyme register**: one concrete process word (Bruise,
  Steep, Stain, Char). No gamer affect — a piece is *finished*, not beaten.
- **The legibility clause (Stew's ruling):** the register is not
  totalizing — navigation/utility surfaces are named plainly when flavor
  would cost clarity (precedent: the **Deck editor**). Card *names* keep it.
- **"Death card" is a design-conversation term, never UI copy** — on
  screen it's the **Coda**.

## 2. Working agreement (do not violate)

Stew is **not a programmer by trade** — he reads JS/Python and uses git/VS
Code but doesn't write code; he wants to *understand* the architecture.

- **Build in phases, stop at every checkpoint.** One unit at a time:
  summarize, explain the one key concept plainly, wait for "continue."
- **Check in before any non-trivial implementation** — present the options
  before coding; `AskUserQuestion` makes choices concrete.
- **Claude writes code; Stew verifies in the browser.** Hand him clear
  test steps and wait; he doesn't run code on Claude's behalf.
- **Keep code small, boring, idiomatic.** Plain JS; one file per card
  behavior (hooks + Tools component); shared infrastructure gets its own
  `editor/` module, never baked into Editor. Comments only for the *why*.
- **Cross-machine**: the repo is cloned on Arch Linux (primary), Mac, and
  Windows. Never hardcode input/output paths — Setup persists them per
  machine to `~/.deck-config.json` (home dir, not the repo).

## 3. Tech stack

- **Frontend**: Vite + React 18 + **Fabric.js 6.x**, plain JavaScript, no
  TypeScript. `StrictMode` is intentionally OFF in `main.jsx` (Fabric
  can't take the double-effect dev behavior) — don't re-enable it. **Verify
  Fabric APIs against the installed 6.x**; they changed across majors.
- **Backend**: Node 20+ + Express — files only, no deck logic. Preserve in
  `server.js`: `expandTilde`, path-traversal safety (`path.basename` +
  `startsWith`), re-validate folders every request, `/api/images/sample`
  BEFORE `/api/images/:filename`.
- **ML sidecar**: Python FastAPI (rembg cutouts + Real-ESRGAN upscale,
  CPU-only ONNX, models committed). Auto-started by `npm run dev`, exits
  politely without a venv, proxied at `/api/ml/*`. **Graceful degradation
  is a requirement** — the session never blocks on ML; models lazy-load,
  so the first ML card is slow — say so in the UI, don't spinner-block.
- **Frontend = brain, backend = hands.** All deck/canvas/card logic lives
  in React; the backend exists only for what the sandbox can't do.

## 4. Repo layout

```
zymeDraw/
├── CLAUDE.md · README.md · hotkeys.md   # this file / setup / hotkey map
├── card_anatomy.md · card_maker.md      # card designer's contract · Foundry spec
├── to_do/                               # active plans: cards_plan · app_plan · server_plan
├── archive/                             # done/superseded plans (v1–v4 design docs)
├── frontend/src/                        # main.jsx · App.jsx (shell stages) · Setup.jsx (two doors)
│   ├── copy/                            # uiText.json — the ONLY home for user-facing copy
│   ├── assets/cards/                    # card faces <id>.png, 745×1040
│   ├── assets/plates/                   # Foundry blank plates 01–08.png (+ template/ geometry ref)
│   └── editor/
│       ├── Editor.jsx                   # registry dispatcher (no per-card logic!)
│       ├── DeckPanel.jsx                # right sidebar: phase panels + Tools + the deck dock
│       ├── deck.js                      # PURE state machine + selectors
│       ├── masterRaster.js              # offscreen 2400×3000 truth + universal bake
│       ├── brushCore.js                 # stroke engine: mask + reveal sessions
│       ├── cards/                       # registry.jsx + one file per card + factories
│       └── …                            # shared modules: Card.jsx · cardArt.js · keymap.js ·
│                                        #   placement.js · GridPicker.jsx · sessionBindings.js …
└── backend/
    ├── server.js                        # all Express routes + /api/ml proxy
    ├── config-store.js                  # ~/.deck-config.json (per-machine paths)
    └── ml/                              # sidecar: main.py · upscaler.py · models/
```

## 5. The two patterns that hold everything together

**The deck state machine (`editor/deck.js`)** — a **pure reducer**: no
Fabric, no DOM, no side effects; card ids and filenames, never images.
Tuning numbers live in one place (`TUNING` + `MOD_CARDS`). The selectors
derive the deck-overlay views — order-stripping and death-filtering happen
here, never in the UI. Deck-builder rules (cap / floor / copies) live in
`DeckEditor.jsx`, NOT here — the reducer only sees a `[{ id, copies }]` spec.

**The card registry (`editor/cards/registry.jsx`)** — `Editor.jsx` doesn't
know what any card does; it looks up `cardRegistry[id]` and calls lifecycle
hooks (`begin`/`update`/`commit`/`cleanup` + a `Tools` component + control
declarations). Adding a card = ONE registry entry + ONE behavior file.
**Never add per-card branches to Editor.jsx or DeckPanel.jsx** — extend the
registry shape with an optional field Editor applies generically (the shape
lives in `registry.jsx`'s header comment).

**The contract:** after a card's `commit`, Editor performs the **universal
bake** — the canvas flattens to the single base image at master resolution;
there is only ever one committed layer. Cards never implement flattening,
and build on the shared modules, not on Editor special cases.

## 6. Live invariants

- **Canvas is fixed portrait**: working view 800×1000, master/export
  2400×3000. The master raster is the true pixels, the visible canvas a
  scaled proxy; bakes and ML run at master, export writes the master.
- **No session round-cap** — only a death card ends a session.
- **The mask brush is a standing tool, not a card** (op key `conceal`);
  masks are image-native — they travel through move/scale/rotate.
  Within-card undo/redo is for brushes only, never across End.
- **Global modifiers are banned except color adjustments** (influence
  slider required). Any control named `color` seeds a random hue per deal.
- **A card may own the viewport for its session** (Etch) but must restore
  the identity transform in commit AND cleanup — a leaked zoom bakes wrong.
- **Every card face renders through `Card.jsx`** at 745×1040 — nothing
  else may hardcode card geometry.
- **Shipped images: one rule.** An image is tracked iff the app is broken
  without it, and every such image lives under `frontend/` — `assets/cards/`
  (starter faces), `assets/plates/` (Foundry blanks + geometry template),
  `public/` (textures, logo). The gitignore ignores images everywhere else
  (`*.png`/`*.jpg` + big-folder rules); those are its ONLY `!` exceptions.
  Before committing any shipped image, quantize it **in place** with
  `pngquant --quality=70-95 --speed 1 --strip --force` — PNG8 palette keeps
  the `.png` name AND alpha, so it's zero code change (the `cardArt.js` glob
  and all `${id}.png` URLs are untouched). Typical result ~70% off (faces
  42M→12M, plates 77M→19M). pngquant refuses to write a file it can't hit
  q70 on (gradient-heavy ones like `searcher`, plate `05`); force those with
  a wider `--quality=40-95` after a visual spot-check — never on faith,
  palette banding shows on smooth gradients. `card_template/` is the local
  workshop — full-res plate masters (`originals/` + uncompressed punched
  set) and the fonts overlay (proprietary faces, never redistributed) — and
  stays gitignored wholesale; git is NOT its backup.
- **Deck legibility**: set-knowledge is free; order-knowledge and
  order-control are never ambient (exceptions only as dealt/spent
  mechanics); the Coda never appears in REMAINS. `deck.js` enforces this.
- **The deck is the button** — one click commits and deals; the flip is the
  turn separator. Closing the tab still loses in-progress work: by design.
- **All user-facing copy lives in `copy/uiText.json`** (edited via the
  copy editor at `:5174/copy-editor`) and obeys the §1 tone. Card names
  are pure copy — the **id** is the permanent key (files/registry/deck/
  art); re-slugging an id is a deliberate refactor commit.

**Platform traps (silent failures):** bakes render at 3× — filter-heavy
cards can hit WebGL texture caps on conservative devices · 2d `ctx.filter`
needs Safari 18+ (Blur/HSV/Ghost silently no-op there) · Linux folder
dialogs need `zenity`/`kdialog`; `xdg-open` may be absent · a bake/export
mismatching the screen = the filter-flush race on End (`renderAll()`).

## 7. How to run

`npm run install:all` once, then `npm run dev` (frontend :5173, backend
:5174, sidecar). Open <http://localhost:5173>; Setup prefills from
`~/.deck-config.json`.
Hotkey map + decision record: `hotkeys.md` (`editor/keymap.js` dispatches;
`KeysReference.jsx` is the in-app overlay).

## 8. How to add a new card

**Start with `card_anatomy.md`** — the card designer's contract. Fill in
its §9 card sheet before any code; its checklists are the review. Then:
name it in the zyme register (id = name slugified at creation), add the
descriptor to `deck.js`, create `editor/cards/<name>.jsx` + a registry
entry, drop `assets/cards/<id>.png`, hand Stew browser test steps.

**Where to start a fresh session:** this file → `gh issue list` (the
backlog) → the active plan for the work at hand (`to_do/cards_plan.md` or
`to_do/app_plan.md`) → `editor/deck.js` (the session rulebook) → skim
`cards/registry.jsx` and one nearby card file. Check in with Stew before
non-trivial work (§2): one unit, checkpoint, wait for "continue."

WORKLOG.md contains a compact history of completed issues — read the top
entries if you need recent context.
