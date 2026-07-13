# UI design notes — `ui-bg-experiment` branch

Scratch notes for the background / logo experiment. This branch is a
sandbox: it layers a textured background under the app, retones the base,
makes the big chrome panels translucent, and swaps the ZYME text wordmark
for the logo PNG. Nothing here has been merged — it's here to *feel out* a
direction. Delete-to-revert pointers are at the bottom.

## The settled look (current defaults)

These are the values baked in as the load-time default, so `npm run dev`
on this branch comes up in this state, with the **BG EXPERIMENT** panel
open bottom-left for further tweaking:

| knob        | value                    |
| ----------- | ------------------------ |
| base color  | `#252527` (warm near-black) |
| texture     | `black-paper`            |
| blend       | `multiply`               |
| opacity     | `0.70`                   |

The panel color is `--surface` at **50%** (`--surface-panel`), so the
texture reads through the big panels.

> The live switcher persists your last look to `localStorage`
> (`deck.bgExperiment`), which overrides these defaults once you touch it.
> To see the defaults fresh, clear that key (or the site's storage).

## Where each piece lives

- **Base color + texture defaults** — `frontend/src/tokens.css`
  (`--bg`, `--bg-texture`, `--bg-texture-blend`, `--bg-texture-opacity`).
- **The texture layer** — `body::before` in `frontend/src/App.css`. Fixed,
  full-screen, sits behind `#root`, blends against `--bg`. The editor
  container (`.editor`, `editor.css`) is made `transparent` so this one
  shared layer shows through; overlays (`.plinth`, `.grid-picker`) keep
  their opaque `--bg` mask on purpose.
- **Translucent panels** — `--surface-panel` in `tokens.css`, applied to
  `.setup`, `.deck-editor`, `.editor-header`, `.deck-panel`,
  `.layers-panel`, `.keys-panel`, `.deck-sheet`. Small boxes/chips
  (`.deck-count`, `.config-summary > div`, `.thumb-grid li`), buttons
  (`--fill`) and inset fields (`--surface-2`) stay fully opaque.
- **The logo** — `frontend/public/logo/zyme.png` (from `logo/`). Replaces
  the ZYME text in two places: the Setup main menu (`.setup h1.setup-logo`,
  ~56px) and the editor header (`.editor-header h1.editor-brand`, ~22px).
  Both use `filter: drop-shadow(...)` (not `box-shadow`) so the shadow
  hugs the transparent letterforms. Foundry's header still shows the text
  wordmark — not yet swapped.
- **The dev switcher** — `frontend/src/BgTextureSwitcher.jsx`, mounted as a
  sibling of `<App/>` in `frontend/src/main.jsx`. Dev-only; drives the CSS
  variables live and remembers your last look.
- **The texture tiles** — `frontend/public/textures/` (copied from
  `UItextures/`). Two families: transparent dark patterns (dark-dot,
  graphy-dark, hixs-evolution, subtle-dots, dark-matter, blizzard) that
  tile straight over the base at `normal`; and light-gray grain scans
  (fabric-1-dark, black-paper, otis-redding) that want a blend mode.

## Open questions / to decide before this could merge

- Logo weight: `zyme.png` is ~4.7 MB but only ever displays ≤160px wide —
  wants a downscaled copy before any merge.
- Modal legibility: `.keys-panel` / `.deck-sheet` are translucent *and*
  over a scrim — confirm text stays readable.
- Whether the switcher stays (as a dev tool) or the look gets hard-coded
  and the switcher deleted.

## To revert the whole experiment

Remove: the `--bg-texture*` / `--surface-panel` blocks + retoned `--bg` in
`tokens.css`; the `body::before` rule in `App.css` (and restore
`.editor { background: var(--bg) }` in `editor.css`); the logo `<img>`
swaps + their CSS in `App.css` / `Editor.jsx` / `editor.css`; the
`BgTextureSwitcher` import + render in `main.jsx` and the component file.
The `frontend/public/textures/` and `frontend/public/logo/` assets can stay
or go.
