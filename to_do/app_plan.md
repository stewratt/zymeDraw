# ZYME — one application

> The **infrastructure line** — the glue chunk. No longer a "version," just
> a named body of work you can pick up in any order relative to the card
> line (`cards_plan.md`); the two share no dependency, only the repo.
> Written 2026-07-07, the day v4 merged to `main`; the MVP is done, so this
> is not a feature sprint. **The theme is glue: one application, portable,
> readable, ready to wear its real face.** Five tracks, sequenced in §7 —
> but the sequence is a suggestion, not a gate. Nothing here is committed
> to build until its wave opens — §8 holds the questions still owed to Stew.
>
> Companion to CLAUDE.md §0. Read that first for what's true now.
> Itemized as GitHub issues (label `infra`, #1–#11); this doc is the
> rationale the issues point back into.

---

## 0. Where this line starts

`main` holds the complete v1→v4 tool: the session arc, 20 mod cards + 3
Coda, the legible deck (spent/remains), the plinth, the state cache, the
card standard (745×1040 via `Card.jsx`), card face sets + per-copy
variants, the copy editor (`uiText.json` end to end), and Foundry through
its control wave. Still open from v4 (now in `archive/`; carried in
`cards_plan.md` §0): the descent experiment, mid-state pulling, suits, Echo,
Mount, death-crop. Those remain live options — this line doesn't cancel
them, it runs alongside as
the infrastructure work while card design continues on its own clock.

**The name.** The application is now **ZYME** — this project's ultimate
form, so it takes the project's name. "Deck" survives as the mechanic
word (the deck, dealing, deck overlay) and as the composition wing's
informal name; it stops being the product title. This is a copy change
first (`uiText.json`, README, window title), a document-language
migration second (gradual — new docs say ZYME, old docs stay as history).

---

## 1. Track: rename discipline — copy moves free, ids move deliberately

v4 split card **name** (pure copy, edited live in the copy editor) from
card **id** (the permanent key for files, registry, deck, art). That
split works — but it created two failure modes we've now both seen:

1. **Drift**: names wander (freely, by design) until an id like `char`
   no longer resembles its name, and only `CARD_GLOSS` remembers what
   the card is.
2. **The half-rename**: an id change (like v4's `dissolve→blur`) touches
   many homes — registry key, behavior file, `deck.js` line, `uiText.json`
   section, `CARD_GLOSS`, art files in **every set** (including `.2.png`
   variants), doc references — and missing one leaves a ghost.

The easy answer — "never rename" — is wrong for this project: the
codebase is small, and a single model prompt can carry a rename across
every file. So the answer is **procedure, not prohibition**:

- **Names drift free.** That's what the copy editor is for. No action.
- **Id renames are a rite.** Add a **rename checklist to
  `card_anatomy.md`** (a new section beside §5's per-card homes): the
  complete list of id homes, in order, ending with a grep for the old id
  that must come back empty (docs excepted, marked as history). An id
  rename is always its own commit, executed as one prompt against the
  checklist, never bundled with copy edits.
- **Re-sync is optional, not automatic.** When name and id have drifted
  far enough to annoy, Stew calls for the rite. The gloss line keeps the
  drift legible in the meantime.

This is the smallest track — one doc section, no code — and it sets the
tone for the version: the codebase should be **cheap to change safely**.

---

## 2. Track: the merge — Foundry and the studio in one space

Foundry was built as a sibling app (second Vite entry, own Setup, dev-ish
access). The insight from using it: **making cards and making
compositions with the cards you made is one practice**, and seeing your
own faces come up in a deal is the meta-loop that makes the toolchain
feel alive. This line promotes Foundry from dev tool to a first-class wing
of ZYME.

What the merge concretely means (proposal, to refine before the wave):

1. **One entry, two wings.** A single Vite entry with a top-level shell:
   the **studio** (today's Deck session) and the **foundry**. One Setup,
   one config file, shared header. The second entry point retires.
2. **No mid-session crossing.** A session — either kind — is destructive
   and tab-bound; the shell only switches wings between sessions. The
   commitment philosophy applies to navigation too.
3. **Close the loop in-app.** Today the loop has a hand-curation gap:
   Foundry exports to `castsFolder`, Stew moves files into a set folder,
   the studio reads the set. The merge adds the missing room — a small
   **curation view** (register name TBD — the *bindery*? the *drawer*?)
   that shows recent casts and lets you place one into a set as a card
   face (`<id>.png` / `<id>.2.png`), replacing the file-manager step.
   File moves stay backend work (`server.js`); no deck logic leaks in.
4. **The loop becomes visible.** The set switcher already exists; the
   merge makes "cast a face → bind it into the set → deal it" one
   sitting's work inside one window.

Most of the code is already shared (raster, brush core, session
bindings, registry pattern) — the merge is mostly *shell* work, which is
exactly why it belongs in the glue version. It also forces the
readability pass: whatever is awkward to unify was awkward all along.

---

## 3. Track: packaging — from repo to application

The question: what are the options for shipping ZYME as an application
rather than a repo you `npm run dev` in, and what do they cost? The
honest constraint up front: ZYME is **three processes** — the React
frontend, the Express file server, and the Python ML sidecar — and the
sidecar (rembg + Real-ESRGAN, ONNX models, per-machine venv) is the hard
part of every packaging story. Graceful degradation (§CLAUDE 3) is what
makes any of them viable.

**Option A — productionized web app (do this first regardless).**
`vite build` the frontend, serve the static bundle from Express, one
`npm start`. No Vite dev server, no proxy, one port.
- *Pros:* near-zero cost; every other option needs it anyway; it's also
  the deployment story for Track 4 (run it on the image server, open a
  browser on the LAN). Patching = `git pull && npm start`.
- *Cons:* still needs Node installed; still "a repo," just a tidier one.
- *Verdict:* **Wave-0 work.** Not the destination, but the foundation of
  every destination.

**Option B — Electron (the recommendation when the time comes).**
Chromium + Node in one installable. Express runs in-process or as a
child; the frontend loads from the bundle.
- *Pros:* the Node backend ports with essentially no changes — this is
  the decisive fit, since `server.js` *is* a Node app. Real file dialogs
  (the zenity/kdialog Linux issue evaporates). Always-Chromium kills the
  Safari `ctx.filter` caveat (§CLAUDE 8) and pins one canvas/WebGL
  behavior. **Patching is genuinely easy**: `electron-updater` +
  GitHub releases gives auto-update on all three of Stew's platforms;
  `electron-builder` produces installers for Linux/Mac/Windows from one
  config.
- *Cons:* ~200 MB baseline per install; a build/signing pipeline to
  maintain (Mac notarization is the annoying one); Electron version
  upkeep. The sidecar still isn't solved by Electron itself — see below.
- *Verdict:* best fit for this codebase and this maintainer. A Tauri-
  style rewrite buys size we don't need at the price of a backend port
  we'd feel forever.

**Option C — Tauri.** Tiny binaries, Rust core, webview per-OS.
- *Pros:* 10–20 MB installers, less memory, security posture.
- *Cons:* the backend is the problem — Tauri wants file ops as Rust
  commands, so `server.js` gets rewritten in a language nobody here
  maintains, or shipped as a Node sidecar binary (which surrenders the
  size advantage, the one reason to pick Tauri). Per-OS webviews
  reintroduce exactly the browser-divergence pain Electron removes
  (WebKit on Mac = the Safari filter bug, *in the packaged app*).
- *Verdict:* wrong fit. Revisit only if install size ever becomes a real
  complaint.

**Option D — PWA / pure browser.** No. The filesystem model (watched
input folders, export trees, per-machine config) and a local Python
sidecar are beyond what a browser sandbox offers portably.

**The sidecar plan under Electron:** don't bundle Python. Ship the app
with ML as an *optional companion* — first-run offers to set up the
sidecar (venv + models, exactly today's README flow, automated), and the
app runs fully without it, as it already must. Bundling
PyInstaller-frozen ONNX runtimes per-OS is possible but adds hundreds of
MB and a fragile freeze step; defer until there's a reason.

*Sequencing:* Option A early (Wave 0). Electron is its own later wave —
after the merge (package one app, not two) and ideally after the UI
overhaul (ship the real face, not the placeholder).

---

## 4. Track: the living folder — ZYME as a tap on an image stream

The origin design point, now stated in a doc: the input folder is meant
to be pointed at the **output folder of an image server that never stops
generating**. ZYME then isn't a tool you load files into; it's a tap on
a stream — and other people on the network could tap the same stream.

**What already works (verify, then rely on it):** the backend re-reads
the input folder per request and re-validates on every call, so a
growing folder should *already* feed new images into each fresh grid
pick with zero code. The stream scenario is passively supported today.
Confirm this end-to-end (point the input at a folder while a script
drips images into it) before building anything active.

**The connection layer — options, cheapest first:**

1. **Mounted folder (zero code).** The server's output mounted on the
   client machine — Samba/NFS/syncthing — and Setup points at the mount.
   This works *today* and should be the documented baseline. Latency and
   mount hygiene are the OS's problem, not ZYME's.
2. **ZYME lives on the server (small code).** Run the productionized
   build (Track 3, Option A) on the image server itself; Express binds
   to the LAN, anyone opens a browser. The input folder is a local path
   — no mount at all. Needs: a `--host` story, and a think about
   per-machine config (`~/.deck-config.json` becomes per-*server*) and
   two people exporting at once. This is the "people tap into the
   stream" version and it's mostly configuration, not architecture.
3. **The folder becomes live *in the UI* (real feature work).** Watch
   the input folder (`chokidar` in Express, SSE to the frontend) and let
   the session *feel* the stream: a quiet "N new since the deal" tell, a
   freshness bias in `sampling.js` (weight recent mtimes so the grid
   leans toward what the server just made), maybe an opening-pick mode
   that samples only from images that didn't exist when the session
   started. Register matters here: the stream is a *darkroom supply
   line*, not a feed with notification badges — the tone invariant
   applies to how alive the UI acts.

**Boundary:** the complementary refinement app for the server's stream
is a different project. The shared surface is only the folder
convention; nothing in this repo should couple to that app beyond
"images appear in a folder."

---

## 5. Track: the face — a real design language

The UI has been refined in *logic* (flow, panels, the two-press rhythm)
but its *look* is still default-shaped. Stew wants a genuinely unique,
custom design language — a significant standalone project, likely
scaffolded with the paper.design MCP tooling. This track's job is not to do
the overhaul; it's to make sure the codebase is **overhaul-ready** so that
when the design project starts, it's a reskin, not a rewrite.

Readiness pre-work (cheap now, expensive later):

1. **One style authority.** Audit where styles live today (inline style
   objects vs CSS files vs component-local constants) and consolidate
   toward stylesheets driven by **design tokens** — CSS custom
   properties for color, spacing, type scale, radii. The overhaul then
   starts by re-valuing tokens, not hunting hex codes through JSX.
2. **Component inventory.** A short doc (or a section in the design doc
   the overhaul will get) listing every user-facing surface: panels,
   overlays, grids, the card, the plinth, Setup, Foundry's rooms. The
   design language must cover all of it; the inventory is the contract.
3. **Keep the geometry authorities.** `Card.jsx` owns card geometry;
   the canvas is fixed portrait. The design language styles *around*
   these invariants, never through them.
4. **Copy is already out** — `uiText.json` was the hard prerequisite and
   v4 paid it. Wording and visual design are now separately editable,
   which is exactly what a design pass needs.
5. **The register extends to pixels.** §1's tone invariant (studio /
   darkroom / press, never arcade) is the design brief's first line. The
   card standard, the plinth, the deal — the visual language should make
   the *object-ness* of the practice stronger, not gamier.

Token consolidation (item 1) can land early — it helps the merge too,
since one shell wants one style system. The overhaul itself is the last
big wave, positioned right before Electron packaging ships the face to
other machines.

---

## 6. Track: the choreography — a rhythm worth pressing through

The UI is refined in *logic* — flow, panels, the two-press rhythm (§5) —
but the *feel* of moving through a turn is flat. The session is *made of*
its transitions: the End, the deal, the flip, the tools arriving, the
return to a waiting deck. Each one reads today as a **state change**, not
as an **event**. This track's job is to make them land — and to hand the
result to the design-language track (#10) as a **choreography contract**:
the motion, timing, and weight the eventual reskin will animate.

**Register first (§1).** Deck borrows game design to impose constraint; it
must never *present* as a game. "Juicy" here means **weight, consequence,
physicality** — the press coming down, a print sliding into the fix, the
darkroom's deliberate pace. Never arcade feedback: no confetti, no score
pops, no bounce-easing that reads as a mobile game. Motion that flatters
is wrong; motion that makes an action feel *chosen and irreversible* is
right.

**The two invariants this track styles around, never through:** card
geometry stays in `Card.jsx` (§6-live); the canvas stays fixed portrait.
The choreography lives in the shell's transitions and CSS, not in the card
frame or the raster.

### 6.1 What exists today (the honest baseline)

The only real motion in the turn loop is **one animation**: `card--flip`
in `editor/editor.css` — a 480ms `rotateY(90deg)→0` with a slight scale,
played whenever `Card` is rendered with the `flip` prop (the dealt card,
the Coda, the completed face in `DeckPanel.jsx`). It has a
`prefers-reduced-motion` off-switch. Everything else is instant:

- The **bake** (`masterRaster.js` `bake()`) swaps the canvas to a fresh
  flattened master in a single synchronous frame — the most consequential
  moment in the app, and visually a no-op.
- The **deal** (`deck.js` `DEAL`) is a pure reducer state flip; the panel
  simply re-renders from `AwaitingDeal` to `CardRevealed`.
- **Tools** appear the instant `CardRevealed` mounts — no arrival.
- The **return to AWAITING_DEAL** after `COMMIT` is an unmarked re-render.
- Searcher's chosen-card lift (`.searcher-row .deck-cell.chosen`) is a
  120ms transform — proof the register *can* carry a "deliberate lift, not
  a jump"; it just hasn't been extended to the loop.

So the plan is mostly **addition**, not correction — one good instinct
already in the CSS, five flat moments around it.

### 6.2 The moments, inventoried

Each moment below: **now → target (in the §1 register) → cost** (S/M/L and
the files/mechanisms it touches). Costs assume CSS-and-shell work only;
none reaches into `deck.js` (pure) or `Card.jsx` (geometry).

1. **End pressed → the bake → one image again.**
   *Now:* `handleCommit`/`handleEndPlacement` run the card's commit, call
   `bake()`, dispatch. The flatten is a single silent frame; the
   "Committing…" label is the only tell, and only for async cards.
   *Target:* the press coming down. End should read as a **plate pressed
   into paper** — a brief, weighted settle as the layers fuse to one, so
   commitment is *felt as irreversible* rather than smoothed over. Not a
   flash: a short darken-and-settle on the canvas as the master resolves,
   the kind of beat that says *that is fixed now*. This is the most
   important moment in the track — commitment is the mechanic (§1).
   *Cost:* **M** — a commit-transition state in `Editor.jsx` (the
   `committing` flag already exists) driving a canvas-area CSS overlay;
   `bake()` stays synchronous, the choreography wraps it. Must respect the
   filter-flush race (§6-platform) — the visual settle plays *after*
   `renderAll()`, never masking a mid-flush frame.

2. **The deal (Enter/Space) → the card arriving in hand.**
   *Now:* reducer flip; `CardRevealed` pops in with the flip already
   attached to the face.
   *Target:* a card **drawn off the deck** — a short travel/settle into the
   panel's card slot before the face turns, so the deal is an arrival with
   somewhere it came *from*. The deck is a physical stack; a card leaves it.
   *Cost:* **S/M** — a mount transition on the `CardRevealed` container in
   `DeckPanel.jsx` + CSS; sequence it *before* the existing flip so the two
   read as one gesture (arrive, then turn face-up).

3. **The flip → the face landing.**
   *Now:* `card--flip`, 480ms `rotateY`. The one good beat — but it fires
   in isolation, with no arrival before and no weight after.
   *Target:* keep the turn; give it a **landing** — a whisper of settle at
   0% overshoot (no bounce; the register forbids arcade easing), so the
   face doesn't just stop, it *sets*. Tune the curve to feel like card
   stock, not UI.
   *Cost:* **S** — re-tune the `@keyframes card-flip-in` curve/box-shadow
   and sequence it after the deal arrival; no JS.

4. **Tools appearing for the dealt card.**
   *Now:* the card's `Tools` component (`CardRevealed`) mounts instantly
   alongside the face.
   *Target:* the tools **come up as the face sets** — a short staggered
   reveal so the constraint the card imposes *arrives with* the card, not
   before it. The bench is laid out for this one card's work.
   *Cost:* **S** — CSS transition/stagger on the tools container, keyed to
   the flip's completion; no per-card work (stays generic in `DeckPanel`).

5. **The round's work → back to AWAITING_DEAL.**
   *Now:* after `COMMIT`, `CardRevealed` unmounts and `AwaitingDeal`
   re-renders with no marking.
   *Target:* the card **spent and cleared**, the deck **settling back to
   ready** — a brief exit for the finished card (it goes to the record,
   `spentCards`), then the waiting state composing itself. The pause is the
   point: the two-press rhythm lives in this gap, and it should feel like a
   held breath, not a dropped frame.
   *Cost:* **S/M** — exit transition on the committed card + entrance on
   `AwaitingDeal` in `DeckPanel.jsx`.

**Two adjacent beats the track should hold in scope** (same loop, terminal
forms of the same moments):

6. **The Coda arriving / the piece completing.** The death card is dealt
   straight to `COMPLETE` (or `CODA_CHOICE` under Delay). Its flip already
   fires; the *target* is that this deal reads as **heavier** than a mod
   deal — the ending should feel like the ending, a print going into final
   fix, without tipping into fanfare (§1: finished, not *beaten*).
   *Cost:* **S** — a weightier variant of the deal/flip beats, gated on
   `kind === 'death'`.

### 6.3 Card-line beats this track touches (named)

The loop is shell-side, but three card-line moments have their own
choreography and must be named so #52's children don't collide with them:

- **Placement → End** (opening pick and the stash return, #51): the
  placement session's End is the *first* bake a session performs; its beat
  is the same "press" as 6.2.1 but with no card face involved
  (`handleEndPlacement`). The **stash return** (#51) already wants "a beat
  before it becomes a live placement session" — that beat and this track's
  return-to-ready beat are neighbours; coordinate, don't duplicate.
- **Searcher / Skim** (deck-family rounds): these already carry motion
  (the chosen-card lift; the reveal's self-caption). Their commits still
  run the standard End; the track should make the deck-family End feel
  continuous with the image-card End, not bolt a second idiom on.
- **The opening pick grid** (`OPENING_PICK`): out of the turn loop proper,
  but the same register — leave to #9/#10's surface pass unless a child
  explicitly claims it.

### 6.4 The contract handed to #10 (and the boundary)

This track produces a **choreography contract** for the design-language
project (#10): a short spec of *what moves, when, how long, and with what
weight* at each of the moments above — the timing envelope and the register
words ("press," "settle," "fix," "draw off the stack") that the reskin's
motion must satisfy. #10 owns the **look** (tokens, the custom visual
language); #9 owns the **surface inventory**. This track owns **motion,
rhythm, timing, weight** and nothing else:

- It must **not** define color, type, or the card's visual language — that
  is #10. It expresses targets in motion terms and register words, and
  leaves the pixels to the overhaul.
- It must **not** re-inventory surfaces — that is #9. It names only the
  moments in the turn loop.
- Its children may land **before** #10 (as CSS on the current tokens) or be
  deferred into #10's animation pass; either way the contract is the
  durable artifact. Recommended: land the cheap wins (flip tune, tools
  stagger, deal arrival) early as their own units; let the **bake/press**
  beat (6.2.1) — the one with real weight — be a checkpoint of its own.

### 6.5 Where this track must not quietly change the rhythm

**Owner ruling required, do not assume (§6-live: the two-press rhythm is
the design; auto-deal was tried and reverted).** Everywhere below, the
temptation is to make the loop *smoother*; smoothing is exactly how a feel
fix becomes a flow change:

- **The gap between End and Deal is sacred.** The return-to-ready beat
  (6.2.5) must *mark* the pause, never *auto-advance* through it. A settle
  animation that flows straight into a re-deal would be auto-deal by the
  back door. Flagged for Stew: **how long may the "settling back to ready"
  beat run before it risks reading as the app dealing for you?**
- **The bake settle (6.2.1) must not become a skippable transition that
  softens commitment.** If it can be clicked-through or auto-times-out into
  the next deal, it stops selling irreversibility. Flagged: **is a
  weighted, uninterruptible ~Xms settle acceptable, or does any forced
  wait violate the tool's responsiveness?** (Owner's call on the duration
  ceiling.)
- **No new input collapses the two presses into one.** The children must
  not add a "commit-and-deal" affordance even as a convenience. If any beat
  seems to want it, that is a separate ruling, not a choreography detail.

### 6.6 Proposed children (see #52)

Spawned as `proposed` (owner promotes): the bake/press beat, the deal
arrival, the flip tune, the tools stagger, the return-to-ready beat, the
Coda weight, and the contract doc for #10. Each is one moment (or a tight
cluster), buildable on the current tokens; costs above.

---

## 7. The invariants this line must not bend

Carried forward explicitly, because glue work is where invariants get
smeared:

- Frontend = brain, backend = hands. The merge and the stream features
  add *rooms* and *file plumbing*, never deck logic in Express.
- `deck.js` stays pure; the registry pattern holds; no per-card branches
  in Editor/DeckPanel. Foundry's shell unification must not fork these.
- Set-knowledge free; order-knowledge and order-control never ambient.
- Destructive commitment is the mechanic — including no mid-session wing
  switching in the merged shell.
- The tone invariant covers the new surfaces: the curation room, the
  stream tells, the packaged app's chrome, and the eventual design
  language itself.
- Graceful degradation of ML is what makes packaging viable — protect it.

---

## 8. Waves (proposed sequence, checkpoint map)

- **Wave 0 — housekeeping.** ZYME title in copy + README; the rename
  rite lands in `card_anatomy.md`; production build (`vite build` +
  Express static + `npm start`); verify the growing-folder behavior
  end-to-end. Small, independent, immediately useful.
- **Wave 1 — the merge.** One entry, the two-wing shell, shared Setup;
  then the curation room. Retire the second Vite entry.
- **Wave 2 — the stream.** LAN/server deployment story (host binding,
  config placement), then the live-folder features (watch → tell →
  freshness bias) as appetite dictates.
- **Wave 3 — the face.** Token consolidation first (may land as early as
  Wave 1), then the full design-language project with paper.design. The
  **choreography track (§6)** rides alongside: the cheap motion wins can
  land early on the current tokens, and its choreography contract is a
  prerequisite input to the paper.design pass (the reskin animates what §6
  specifies).
- **Wave 4 — the package.** Electron: builder config, updater, sidecar
  companion install. Ships the merged, redesigned app.

Card-design work (v4 notes §10: descent, suits, Echo, Mount…) runs
parallel to all of this on its own checkpoints.

---

## 9. Open questions for Stew (answer before each wave opens)

1. **The merge shape (Wave 1):** is the foundry a *wing* behind one
   shell (recommended above), or does the studio grow a door to it some
   other way? And what's the register name for the curation room?
2. **ZYME styling:** all-caps ZYME everywhere, or Zyme in prose? (Copy
   editor makes this cheap to change, but pick one for docs.)
3. **The stream (Wave 2):** is multi-user (several people tapping one
   server) a real target for this line, or is single-Stew-on-LAN enough for
   now?
   Multi-user pulls config/export decisions forward.
4. **Order of face vs package (Waves 3/4):** overhaul before Electron
   (recommended — ship the real face) or package early to start living
   with the app-ness?
5. **Rename rite scope:** checklist-only (recommended), or also a
   `tools/` script that mechanically greps the homes?
6. **The choreography and the rhythm (§6.5):** two rulings the motion track
   must not decide for itself. (a) How long may the "settling back to
   ready" beat run before it risks reading as the app dealing *for* you —
   i.e. auto-deal by the back door? (b) Is a weighted, uninterruptible
   ~Xms bake/press settle acceptable to sell irreversibility, or does any
   forced wait violate the tool's responsiveness — and what is the duration
   ceiling? Both gate #52's bake-press and return-to-ready children.
