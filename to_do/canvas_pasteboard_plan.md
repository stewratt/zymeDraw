# Canvas Pasteboard — Phased Execution Plan

> **Branch:** `feature/53-canvas-zoom-pan` · **Issue:** #53
> A coordination doc so multiple agents can each execute one phase.
> Read this top-to-bottom, then read your assigned phase's **Scope**,
> **Files**, **Do**, and **Verify** before touching code.

---

## 0. The goal, in one paragraph

Replace the current **fixed-porthole** zoom/pan with a **Photoshop/PureRef
pasteboard**: the artboard (the 800×1000 white canvas) floats in a large
gray void, the *camera* pans and zooms freely over it, the artboard can sit
anywhere on screen (left, right, filling the view when zoomed in), and the
deck panel + header float *over* the surface. We move the **view**, never
the artboard — the artboard stays fixed in document space exactly as
Photoshop does. This is **Approach A**.

## 1. Why this is tractable (the load-bearing facts)

- The app rests on one identity today: **visible buffer == artboard ==
  800×1000**, and `bake()` snapshots the *whole buffer* at 3× into the
  master. A pasteboard **splits** those: the buffer becomes the whole
  workspace; the artboard is a rectangle floating inside it.
- **The artboard stays anchored at scene (0,0)→(800,1000).** Because every
  card works in scene coordinates, keeping the artboard at the origin means
  **no card file changes** — the whole job lives in four files.
- **The bake-crop is already verified** against installed Fabric 6.9.1.
  `canvas.toCanvasElement(multiplier, { left, top, width, height })` is a
  documented, working crop (dist/index.js:3403–3441). After `bake()` resets
  the viewport to identity, `toCanvasElement(3, {left:0, top:0, width:800,
  height:1000})` renders exactly the artboard rectangle into the 2400×3000
  master. No temp-canvas fallback is needed.

## 2. The four files that change (and the one thing that must not)

| File | Role after the change |
|------|-----------------------|
| `frontend/src/editor/CanvasStage.jsx` | Buffer fills the workspace, resize-aware. Splits fixed **artboard** dims from dynamic **buffer** dims. |
| `frontend/src/editor/canvasNav.js` | Free camera: fit-and-center reset, free pan, soft clamp, zoom the whole view. |
| `frontend/src/editor/masterRaster.js` | Artboard drawn as a scene object at (0,0); `bake` crops to the artboard rect; `showMaster` scales to the artboard footprint, not the buffer. |
| `frontend/src/editor/editor.css` (+ small `Editor.jsx` layout) | `canvas-area` full-bleed; deck panel + header float over as overlays. |

**Invariant that must not break (CLAUDE.md §6):** a leaked zoom/pan must
never bake wrong. `bake()` keeps its identity-reset chokepoint; the crop is
applied *after* the reset. Export reads the master directly and is untouched.

## 3. Coordinates & naming convention (shared vocabulary)

- **Artboard coords** = the old scene coords, `0..800 × 0..1000`. Cards use
  these; they do not change. Introduce `ARTBOARD_WIDTH = 800`,
  `ARTBOARD_HEIGHT = 1000` as the names for "what a card sees."
- **Buffer** = the Fabric canvas pixel buffer = the whole workspace, dynamic.
- **Viewport transform** = the camera. Pan/zoom move this, never the artboard.
- `CANVAS_WIDTH`/`CANVAS_HEIGHT` currently mean *both* buffer and artboard —
  Phase 1 splits them. Keep `CANVAS_WIDTH`/`HEIGHT` as the **artboard**
  export (masterRaster imports them) to minimize churn; add buffer sizing
  separately.

---

## Phase 1 — Full-window, resize-aware buffer

**Scope:** the Fabric buffer stops being a fixed 800×1000 stretched by CSS;
it becomes the actual pixel size of the workspace and tracks resizes.

**Files:** `CanvasStage.jsx` (primary), `editor.css` (canvas sizing rules).

**Do:**
1. Keep `CANVAS_WIDTH = 800` / `CANVAS_HEIGHT = 1000` exported as the
   **artboard** dims (masterRaster + Editor still import these as
   `canvasWidth`/`canvasHeight` for cards — do not repurpose them).
2. Create the Fabric canvas at the workspace's current pixel size, not
   800×1000. Add a `ResizeObserver` on `.canvas-area` (or the wrap) that
   calls `canvas.setDimensions({ width, height })` and re-renders on resize.
3. Remove the CSS that stretches the buffer (`canvas-wrap` fixed
   `aspect-ratio`/`height`, the `!important` 100% sizing on
   `.canvas-container`/`canvas`). The buffer now matches its box 1:1.
4. Handle devicePixelRatio deliberately — decide retina on/off here and
   note it (watch-item: full-window × retina × 3× bake can hit WebGL caps).

**Verify (browser):** canvas fills the whole workspace area; resizing the
window resizes the buffer with no blur/stretch; dealing a card, placing, and
End all still work (artboard will still look like it fills the box until
Phase 2 — that's expected).

**Done when:** buffer size == workspace size, resize-tracked, session
unbroken.

---

## Phase 2 — Artboard as a scene object at the origin

**Scope:** the white artboard becomes a fixed rectangle at scene (0,0) with
an 800×1000 footprint; everything around it is void gray.

**Files:** `masterRaster.js` (`showMaster`), `editor.css` (void color,
paper border/shadow).

**Do:**
1. In `showMaster`, draw the master at scene `left:0, top:0` scaled to the
   **artboard footprint** (`scaleX = ARTBOARD_WIDTH / master.width`), NOT to
   `canvas.getWidth()/getHeight()` — that's the buffer now.
2. Set the canvas `backgroundColor` to a void gray (studio/darkroom tone,
   not arcade — see CLAUDE.md §1). The white "paper" is the artboard image.
3. Give the artboard a floating-paper edge: a subtle border + shadow. Prefer
   a non-selectable, non-evented Fabric rect behind the master, or a CSS/
   overlay treatment — do NOT make the artboard selectable/draggable.

**Verify (browser):** a white 800×1000 artboard sits in a gray void; at
default fit it's centered; no interaction grabs the artboard itself.

**Done when:** artboard renders at scene origin with void around it; cards
still deal onto it correctly.

**Depends on:** Phase 1 (needs the split buffer/artboard dims).

---

## Phase 3 — Free camera (pan/zoom the whole view)

**Scope:** the camera roams. Fit-and-center reset, free pan with a soft
clamp, zoom toward cursor over the whole view.

**Files:** `canvasNav.js` (primary), `Editor.jsx` (reset call sites already
exist — verify they still mean "fit").

**Do:**
1. `reset()` becomes **fit-and-center**: compute a `viewportTransform` that
   scales the artboard to fit the current buffer with margin and centers it.
   This is also the `0` key and the auto-reset on deal/End/phase change.
2. Pan (Space+drag) moves `vpt[4]/vpt[5]` freely.
3. Replace the hard `clampPan()` (which pins edges) with a **soft clamp**:
   keep at least a slice of the artboard on-screen (e.g. its bounding box
   must still intersect the viewport, or ≥ N px visible) so the artboard can
   roam to either side or fill the screen but can never fully vanish.
4. Keep zoom `zoomToPoint(getScenePoint(e), zoom)`, clamp `0.5×–8×` (revisit
   max now that the artboard can be small in a big void).
5. On buffer resize (Phase 1), re-fit or preserve the camera sensibly.

**Verify (browser):** Space+drag slides the artboard anywhere in the void;
Ctrl/Cmd+scroll zooms toward the cursor and can make the artboard fill the
screen; `0` snaps back to a centered fit; the artboard can't be lost.

**Done when:** the Photoshop feel is there — drag the canvas around, zoom to
fill, never lose it.

**Depends on:** Phase 2. **Watch:** Etch / any `ownsViewport` card (see §4).

---

## Phase 4 — Bake crops to the artboard

**Scope:** End commits exactly the artboard pixels regardless of camera.

**Files:** `masterRaster.js` (`bake`, `showMaster`).

**Do:**
1. Keep the identity-reset chokepoint in `bake` (it guarantees the crop
   origin is the artboard's scene position).
2. Change the snapshot to the **verified crop**:
   ```js
   canvas.toCanvasElement(MASTER_SCALE, {
     left: 0, top: 0,
     width: ARTBOARD_WIDTH, height: ARTBOARD_HEIGHT,
   })
   ```
3. Ensure `showMaster` (called post-bake) scales to the artboard footprint
   (Phase 2 already did this — confirm the post-bake path uses it).
4. After bake, the camera should return to the fit view (Editor's reset
   effect fires on transitions — confirm it runs post-End).

**Verify (browser):** zoom/pan hard, then End — the committed master matches
the artboard exactly (no shift/scale/void baked in). Export at the Coda is
pixel-correct. Bake after bake after bake stays sharp.

**Done when:** the universal bake is camera-independent and the master is
always the clean artboard.

**Depends on:** Phase 2. Can proceed in parallel with Phase 3 but must be
tested together (a leaked camera + crop is the exact failure to prove
against).

---

## Phase 5 — Floating panels over the surface

**Scope:** the surface goes full-bleed; the deck panel and header float over
it as translucent overlays, matching the "scene below, panels over" feel.

**Files:** `editor.css` (primary), `Editor.jsx` (layout structure only).

**Do:**
1. `.editor-main` stops being a `1fr 340px` grid that boxes the canvas.
   `canvas-area` becomes full-bleed (fills the workspace behind everything).
2. The `side-stack`/deck panel becomes an absolutely-positioned overlay
   (right side), translucent background so the surface reads underneath.
3. The header likewise floats (or stays a thin bar) over the surface.
4. Keep the existing canvas-area overlays working: `GridPicker`, `Plinth`,
   `CardOverlay` already position against `canvas-area` — verify they still
   land correctly over the full-bleed surface.
5. Honor CLAUDE.md §1 tone in any new copy/labels (studio, not arcade).

**Verify (browser):** the artboard surface spans the window; the deck panel
and header float over it; the opening GridPicker, a card overlay (e.g.
Ghost), and the finished Plinth all still render and interact correctly.

**Done when:** the full tabletop scene reads as one surface with floating
chrome.

**Depends on:** Phases 1–2 (visual), independent of 3–4 logic.

---

## 4. Watch-items (call out, do not bury)

- **Etch and any `ownsViewport` card.** Etch drives its own viewport and
  computes zoom-to-fit assuming **buffer == artboard**. With a full-window
  buffer and an artboard at (0,0), its math needs review in Phase 3/4. This
  is the single card most likely to break — test it explicitly.
- **Retina × full-window × 3× bake.** The bake renders at 3×; a full-window
  buffer on a retina display multiplies texture size and can hit WebGL caps
  on conservative GPUs (CLAUDE.md §6). Decide `enableRetinaScaling` in
  Phase 1 and keep an eye on bake on large windows.
- **Soft-clamp feel** is a tuning problem — iterate in the browser with Stew,
  don't ship the first constant.
- **Export is untouched** — it reads the master directly. If you find
  yourself editing export, stop; you've gone off-plan.

## 5. Sequencing for parallel agents

- **Phase 1 first** (everyone depends on the buffer/artboard split).
- **Phase 2** next (visual foundation for 3, 4, 5).
- **Phases 3 & 4** can be built in parallel but **must be verified together**
  (camera + crop is the core correctness proof).
- **Phase 5** is mostly CSS and can land last or in parallel after Phase 2.
- Each phase ends at a **browser checkpoint** — hand Stew the Verify steps
  and wait; Claude writes code, Stew verifies (CLAUDE.md §2).
