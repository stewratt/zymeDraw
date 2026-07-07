# UI flexibility audit — 2026-07-07

Prompted by the horizontal scrollbar on the finished-piece panel (Deck's
Coda screen and Foundry's Proof screen). The scrollbar is fixed; this is
the record of the root cause and a full pass over all three stylesheets
(`App.css`, `editor/editor.css`, `foundry/foundry.css`) for how well the
UI scales. Verdict up front: **the layout architecture is fundamentally
sound** — the skeleton flexes correctly, the modern patterns are already
in place — and the one systemic defect it did have is now fixed.

---

## 1. The scrollbar: root cause and fix (DONE)

**The bug was not on the final screen — it was everywhere.** The app had
no `box-sizing` reset, so every element used CSS's default `content-box`
model, where `width: 100%` means *content only* and any border or padding
is added ON TOP. The finished-piece thumbnail (`.export-thumb`) is
`width: 100%` with a 1px border — so it rendered 2px wider than its
panel, every time.

Only the final screen *showed* it because of a second, quieter rule:
`.panel-scroll` sets `overflow-y: auto`, and per the CSS spec, setting
one overflow axis to `auto` silently forces the other axis from
`visible` to `auto` as well. Two invisible defaults multiplied: a 2px
overflow anywhere inside the panel summons a full horizontal scrollbar,
and the final screen is the only phase that mounts a full-width bordered
image inside the scroll region.

**Fixes applied:**

1. **Global border-box reset** at the top of `App.css` (loaded by both
   apps): `width: 100%` now means the whole box, borders included. This
   kills the entire *class* of bug, not just this instance — the same
   2px overflow was latent in the color-swatch inputs (`.ctrl
   input[type="color"]`), the 104px card tiles (which overflowed their
   104px `.deck-cell` by their border), and every future full-width
   bordered element anyone adds.
2. **`overflow-x: hidden` on `.panel-scroll`** — states the intent
   (panel content only ever scrolls vertically) so no future 1px
   accident can resurface the bar.

**Border-box side effects, checked rule by rule:** everything with an
explicit width + border/padding now renders its content a hair smaller
instead of its box a hair bigger. Audited every affected rule: the Setup
card, the Keys/Deck sheets (content 2px narrower — fluid text, no
change), card tiles (now fit their cells *exactly*, an improvement), the
canvas container (display area 2px smaller inside its border instead of
the border poking outside — Fabric's pointer math reads the canvas
element's own rect, so accuracy is untouched). Nothing depends on
content-box arithmetic. No JS reads widths that shift.

---

## 2. What is already right (keep doing these)

- **The height chain is disciplined.** `100vh` shell → `flex: 1` main →
  `min-height: 0` at every flex/grid level that needs it → scroll happens
  in exactly one designated place per panel (`.panel-scroll`, the layer
  stacks, the plate grid). This is the hard part of flexbox layout and
  it's done correctly throughout.
- **The pinned-action pattern.** The panel never scrolls as a whole; the
  primary button (End/Deal/Cast) sits below the scroll region, so it
  lands in the same spot every round. Deliberate, documented in the CSS,
  and worth protecting.
- **Container queries are already in use** (`.grid-thumbs-fit` uses
  `container-type: size` + `cqw/cqh` to fit image grids with zero JS).
  This is the most scalable sizing pattern in the codebase — see §3.1
  for where else it should apply.
- **One token sheet.** All color/radius decisions live in `:root` vars
  in `App.css`; editor.css and foundry.css consume them. Foundry reuses
  Deck's layout classes wholesale instead of forking them. This is
  exactly how two apps stay one visual language.
- **Overlays are viewport-safe**: the Keys sheet, deck sheet, and card
  zoom all use `min(fixed, calc(100vw/vh − margin))` so they can never
  outgrow the window.
- **Ellipsis/wrapping hygiene**: long filenames get
  `overflow: hidden + ellipsis`, the export path gets
  `word-break: break-all`. Nothing user-supplied can widen the layout.

---

## 3. Findings — worth fixing, none urgent

### 3.1 The canvas cap is viewport-math, not container-fit
`.canvas-wrap { height: min(86vh, 800px) }` sizes the canvas from the
*viewport*, but the space it actually lives in is `.canvas-area` (the
viewport minus header, padding, gaps). The `86vh` guess at that
subtraction breaks on windows shorter than ~645px: the canvas outgrows
its area and clips. Same pattern in the magic offsets
`calc(100vh - 320px)` (`.work-glance img`, `.card--reveal`) and
`calc(100vh - 140px)` (`.card--zoom`) — each hardcodes "the chrome is
N px tall" and silently drifts if the header or paddings ever change.
**Recommendation:** make `.canvas-area` a size container (it's already
`position: relative`) and size the wrap with `cqh` — the same pattern
`.grid-thumbs-fit` already proves out. One change, and every "minus the
chrome" guess disappears.

### 3.2 `.layer-row` is defined twice
`editor.css` has two full `.layer-row` blocks (placement-panel section
~line 575 and layers-panel section ~line 760) with overlapping-but-
different properties, merged only by cascade order. Same for the
near-identical `.placed-files li` / `.layer-name` monospace-row look.
Works today, but a future edit to one block will half-apply.
**Recommendation:** collapse to one `.layer-row` definition; keep
section-specific deltas as modifier classes.

### 3.3 Twinned constants with no shared source
- Card tile width: `.card--tile { width: 104px }` and
  `.deck-cell { width: 104px }` must agree by hand.
- Foundry's workspace rounding: `border-radius: 5% / 3.582%` in
  foundry.css derives from `CORNER_RADIUS_FRAC = 0.05` in
  `cardCorners.js` and the 745/1040 face — three files, one law.
**Recommendation:** promote to tokens (`--tile-w: 104px`,
`--corner-frac`) next time any of them is touched. Not worth a
standalone pass.

### 3.4 Fixed 340px sidebar
`.editor-main { grid-template-columns: 1fr 340px }`. For a desktop
studio tool this is a reasonable, deliberate choice — the panel is a
control surface, not content — and nothing overflows it (§1's fix
guarantees that). Flag only: there are no responsive breakpoints at all,
so below ~900px window width the canvas gets crushed. If small-window
use ever matters, `minmax()` the columns; until then, leave it.

### 3.5 Button styles are converging but not shared
`.deck-panel button.primary` / `.grid-picker button.primary` (selector
lists), `.setup .browse` vs `.deck-panel button.secondary` (same look,
two definitions). Fine at two apps; if a third surface appears, move
`.primary`/`.secondary` to App.css as app-agnostic classes.

### 3.6 Cosmetic: OS-default scrollbars
The chunky light scrollbar in the screenshot is the platform default —
visually loud against the greyscale UI. Optional one-liner polish:
`scrollbar-width: thin; scrollbar-color: var(--border-strong)
transparent;` on the scroll regions. Purely aesthetic; skipped for now.

---

## 4. The rules going forward

1. **Border-box is now the law** — never compensate for borders in
   widths again; if a width calc subtracts border pixels, it's wrong.
2. **Scroll in one axis, on purpose.** Any new `overflow-y: auto`
   region gets an explicit `overflow-x: hidden` (or clip) with it.
3. **Size from the container, not the viewport.** `vh/vw` are for
   fixed-position overlays only; anything inside the layout should get
   its size from flex/grid or container-query units.
4. **New sizes that two rules share become a token first.**
