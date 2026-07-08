# v5 plan — ZYME: one application

> Written 2026-07-07, the day v4 merged to `main`. The MVP is done; v5 is
> not a feature sprint. **The theme is glue: one application, portable,
> readable, ready to wear its real face.** Five tracks, sequenced in §7.
> Nothing here is committed to build until its wave opens — §8 holds the
> questions still owed to Stew.
>
> Companion to CLAUDE.md §0. Read that first for what's true now.

---

## 0. Where v5 starts

`main` holds the complete v1→v4 tool: the session arc, 20 mod cards + 3
Coda, the legible deck (spent/remains), the plinth, the state cache, the
card standard (745×1040 via `Card.jsx`), card face sets + per-copy
variants, the copy editor (`uiText.json` end to end), and Foundry through
its control wave. Still open from v4 (its notes §10): Wave 3 (the descent
experiment), mid-state pulling, suits, Echo, Mount, death-crop. Those
remain live options — v5 doesn't cancel them, it runs alongside as the
infrastructure line while card design continues on its own clock.

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
feel alive. v5 promotes Foundry from dev tool to a first-class wing of
ZYME.

What the merge concretely means (proposal, to refine before the wave):

1. **One entry, two wings.** A single Vite entry with a top-level shell:
   the **studio** (today's Deck session) and the **foundry**. One Setup,
   one config file, shared header. The second entry point retires.
2. **No mid-session crossing.** A session — either kind — is destructive
   and tab-bound; the shell only switches wings between sessions. The
   commitment philosophy applies to navigation too.
3. **Close the loop in-app.** Today the loop has a hand-curation gap:
   Foundry exports to `castsFolder`, Stew moves files into a set folder,
   the studio reads the set. v5 adds the missing room — a small
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
scaffolded with the paper.design MCP tooling. v5's job is not to do the
overhaul; it's to make sure the codebase is **overhaul-ready** so that
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

## 6. The invariants v5 must not bend

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

## 7. Waves (proposed sequence, checkpoint map)

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
  Wave 1), then the full design-language project with paper.design.
- **Wave 4 — the package.** Electron: builder config, updater, sidecar
  companion install. Ships the merged, redesigned app.

Card-design work (v4 notes §10: descent, suits, Echo, Mount…) runs
parallel to all of this on its own checkpoints.

---

## 8. Open questions for Stew (answer before each wave opens)

1. **The merge shape (Wave 1):** is the foundry a *wing* behind one
   shell (recommended above), or does the studio grow a door to it some
   other way? And what's the register name for the curation room?
2. **ZYME styling:** all-caps ZYME everywhere, or Zyme in prose? (Copy
   editor makes this cheap to change, but pick one for docs.)
3. **The stream (Wave 2):** is multi-user (several people tapping one
   server) a real v5 target, or is single-Stew-on-LAN enough for now?
   Multi-user pulls config/export decisions forward.
4. **Order of face vs package (Waves 3/4):** overhaul before Electron
   (recommended — ship the real face) or package early to start living
   with the app-ness?
5. **Rename rite scope:** checklist-only (recommended), or also a
   `tools/` script that mechanically greps the homes?
