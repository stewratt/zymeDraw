# Splatt — plan of attack

> The gaussian-splat card: snapshot the composition, cast it into false
> 3D, orbit to a new viewpoint, commit that view as the new state.
> Decisions below were made with Stew 2026-08-14. This builds on a
> standalone prototype (`splat_mvp/`) that proved the pipeline; it never
> landed on main — it lives on the `origin/splat-mvp` branch.

## 1. Decisions (interview record)

- **Backend**: extend the existing FastAPI sidecar (`backend/ml/main.py`)
  with a `/splat` endpoint. Torch + SHARP are *optional* imports; the
  sidecar reports the capability in `/health` and works fine without them.
- **Orbit**: free within the library's proven fence (Stew, 2026-08-15,
  at the phase-2 checkpoint): the built-in controls' polar band
  (~13°–135°) stays — it's what the prototype ran and the poles jitter.
  No dolly/azimuth limits. The shredding/streaking as the camera leaves
  the original viewpoint is the medium, not a defect.
- **Void fill**: the committed view is composited **over the pre-card
  snapshot** — where the splat has no coverage, the old composition shows
  through the tears. No dead pixels, and the fill is meaningful.
- **Input resolution**: master downscaled to ~1536 px long edge before
  predict (tunable constant; profile on both machines).
- **Name**: **Splatt** (id `splatt`). Stew's call — the register bends for
  a card whose material has a proper name.
- **Degradation**: capability-gated in the **Deck editor** — on a machine
  where the sidecar lacks splat support, the card can't sit in the active
  deck, so a session never meets a dead card.
- **Warm-up**: **pre-warm at session start** — if `splatt` is in the
  active deck, the frontend pokes the sidecar to load the model in the
  background the moment the session begins.
- **In-card UI**: pure orbit (drag = orbit, scroll = dolly, right-drag =
  pan) plus one "original view" reset. No other controls.

## 2. Card sheet (card_anatomy.md §9)

- **id / label**: `splatt` / Splatt
- **Family**: canvas
- **Tier**: rare
- **Copies**: 0 — pool-only (standing rule for new cards), `rarity: 'scarce'`
- **Primitive chain**: Re-frame × depth cast — kin to Closer/Deeper, but
  the re-photograph happens with a 3D camera instead of a 2D crop
- **The constraint**: exactly one action — choose a viewpoint
- **The freedom inside**: the whole camera sphere; near = subtle parallax,
  far = tears and smears revealing the old composition underneath
- **Controls**: none (a reset-view button in Tools, not a control key)
- **Randomized opening?**: no — opens at the original photo's viewpoint
- **Registry capabilities**: `Overlay` (the 3D viewport owns the canvas
  area), async `begin` (awaits the predict; End disabled until it
  resolves), async `commit` (offscreen master-res render + composite),
  `postCommitReview` like the re-frame pair — the result is a
  transformation worth holding open on, with a `waitNote` for the render
- **New mechanics?**: none in deck.js. One genuinely new piece of shared
  infrastructure: a WebGL splat viewport module (`editor/splatView.js`)
  — see §4. Capability gating adds one field to the Deck editor's
  card-availability logic (not the reducer).
- **Copy**: (drafts, to land in `uiText.json` via the copy editor)
  - hint while predicting: "Casting the piece into depth — first time on
    this machine takes longer while the model loads."
  - hint while live: "Orbit to a new viewpoint. The deck commits the view
    you're looking at."
  - waitNote: "Re-photographing at full resolution…"
- **Face**: `assets/cards/splatt.png`, 745×1040 — text face stands in.

## 3. Architecture / data flow

```
begin:
  master (2400×3000) ──downscale 1536──▶ PNG ──POST /api/ml/splat──▶
  sidecar (SHARP, cuda|mps|cpu) ──▶ .ply bytes ──▶ blob URL ──▶
  GaussianSplats3D viewer mounted in the card Overlay (4:5, matches artboard)

session:  user orbits (free); reset returns to the original camera

commit:
  chosen camera ──▶ offscreen render at 2400×3000, alpha background ──▶
  composite over pre-card master snapshot ──▶ set as canvas base image ──▶
  universal bake (Editor's job, as always)
```

Key invariant kept: the sidecar stays pure compute (image bytes in, ply
bytes out — no files, no sessions); the frontend stays the brain.

## 4. The pieces

### 4a. Sidecar (`backend/ml/`)

- `splatter.py` — new module, mirrors `splat_mvp/server.py`'s core:
  - lazy `import torch` / `from sharp...` inside functions; module-level
    `available()` probe (can torch + sharp be imported?)
  - device pick: `cuda` → `mps` → `cpu` (MPS is the ARM path; report the
    device so the UI can be honest about speed)
  - model load once via `torch.hub.load_state_dict_from_url` (2.7 GB,
    cached in `~/.cache/torch` — NOT committed; this is the documented
    exception to the models-in-repo rule, it's simply too big)
  - `predict_png(data: bytes) -> bytes`: decode → predict → `save_ply` to
    a temp path → return the bytes. OOM retry after `empty_cache()`, and
    `empty_cache()` after every predict (both proven in the MVP).
- `main.py` additions, same shape as the existing endpoints:
  - `POST /splat` — image bytes in, `.ply` bytes out
    (`application/octet-stream`), single-flight lock like the MVP's
  - `POST /splat/warm` — returns immediately, loads the model on a
    background thread
  - `/health` gains `splatAvailable`, `splatLoaded`, `splatDevice`
- `requirements-splat.txt` — torch + SHARP (Apple's `ml-sharp` from git),
  deliberately NOT in `requirements.txt`: `npm run install:all` stays
  light; a machine opts in with one documented pip command (README
  section, per-machine like everything else). CUDA wheel on Arch, default
  wheel on the Mac (MPS comes free).
- Express: nothing — `/api/ml/*` proxy already covers it. Check the proxy
  has no response-size/timeout issue with a multi-MB ply / ~12 s predict.

### 4b. Frontend viewer module (`editor/splatView.js`)

Shared infrastructure, not card-private (Fracture-family successors could
reuse it). Wraps `three` + `@mkkellogg/gaussian-splats-3d` (real npm deps
now, ~same versions as viewer.html; no CDN):

- `createSplatView(container, plyBlob)` → `{ resetCamera, getCamera,
  renderAt(width, height) → canvas, dispose }`
- camera setup straight from viewer.html: OpenCV convention, up (0,-1,0),
  camera at origin looking at (0,0,2) = the original photo's view
- `sharedMemoryForWorkers: false` (no COOP/COEP headers in dev)
- viewport element is strictly 4:5 so the on-screen frame IS the commit
  frame (WYSIWYG)
- `renderAt`: resize the renderer to 2400×3000 with alpha, render one
  frame with the live camera, read back, restore size. 2400×3000 is under
  common WebGL limits, but this is the risk line — fallback: render at
  1200×1500 and upscale 2×.

### 4c. The card (`editor/cards/splatt.jsx` + registry entry)

- `begin` (async): snapshot the master → keep it (it's the void fill) →
  downscale → POST `/splat` → build the viewer in the Overlay. Status copy
  through the wait; `isCancelled` honored so a restart mid-predict doesn't
  mount a dead viewer. On sidecar failure: the card explains and the
  session must not wedge (Editor's begin-await path already keeps End
  disabled; we need restart to remain available — verify).
- `Overlay`: the mounted splat viewport (this card's decision is spatial,
  so it owns the canvas area, like Stamp's overlay does for picks).
- `Tools`: the hint + reset-view button.
- `commit` (async): `renderAt(2400,3000)` → draw over the kept snapshot →
  hand the composite to the canvas as the new base → Editor bakes.
  `postCommitReview` holds the round open on the result.
- `cleanup`: dispose the viewer (workers + GL context — the library's
  `dispose()` handles it; verify no leaked contexts across restarts).
- `deck.js`: one MOD_CARDS line, copies 0, scarce.

### 4d. Pre-warm + gating

- Session start: if the active deck spec includes `splatt`, fire-and-forget
  `POST /api/ml/splat/warm`.
- Deck editor: fetch `/health` once; if `splatAvailable` is false, show
  `splatt` as unavailable-on-this-machine and block adding it.
- **Cross-machine edge** (ruled at the phase-3 checkpoint, 2026-08-15):
  session setup re-checks capability and, if the active deck contains an
  unavailable card, routes through the Deck editor with a plain notice —
  never silent filtering.
- **Failed-cast Continue** (ruled same checkpoint): when the cast fails,
  the round still holds open on Continue over an unchanged piece —
  accepted as-is; `postCommitReview` stays a static field, no registry
  extension for a rare edge.

## 5. Risks

1. **MPS correctness/speed** — SHARP is Apple's own model so MPS should be
   a first-class path, but it's unproven here. Phase 1 profiles it on the
   Mac; if it's minutes-slow, the capability check may need a device gate.
2. **Master-res WebGL render** — the one technically novel step. Spike it
   early (phase 2), have the half-res+upscale fallback ready.
3. **Splat library lifecycle in React** — workers, GL contexts, disposal
   across restarts. The MVP only ever loads into a fresh page.
4. **Proxy limits** — multi-MB ply through Express; long predict vs any
   proxy timeout.
5. **Collages aren't photographs** — SHARP's depth guess on a flat collage
   may be near-planar (boring) or chaotic (great). Unknown until played;
   input resolution and nothing else is tunable if it disappoints.

## 6. Build phases (checkpoint after each; Stew verifies in browser)

> **Execution model (Stew, 2026-08-14): each phase runs in sequence in its
> own fresh Opus subagent** — the main session stays the design brain and
> checkpoint gate, the subagent does the mechanical build and reports
> back. One phase at a time, never parallel; Stew verifies between
> phases. Design forks (the cross-machine gating edge, any surprise the
> subagent hits) come back to the main session — subagents don't decide
> design.

1. **Sidecar**: `splatter.py` + endpoints + health + requirements-splat +
   README install section. Verify by curl on the Arch box (and Mac if the
   extra is installed there). *No frontend yet.*
2. **Viewer spike**: npm deps + `splatView.js`, proven in isolation —
   load a ply from phase 1, orbit, and `renderAt(2400,3000)` produces a
   correct alpha-background PNG. This retires risks 2 and 3 before the
   card exists.
3. **The card**: `splatt.jsx`, registry entry, deck.js line, copy in
   uiText.json, text face. Full loop playable: draw → predict → orbit →
   commit → bake. Decide the cross-machine gating edge here.
4. **Polish**: pre-warm at session start, Deck editor gating, failure
   copy, profiling pass on both machines, card face when Stew casts one.
