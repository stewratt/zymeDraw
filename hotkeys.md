# hotkeys.md — a hotkey strategy for Deck

> Status: **implemented 2026-07-05** — the same day the decisions locked
> (W·E·R·S mode row + Conceal→Erase rename; §9 questions all answered).
> The full §5 map is live, built in the §8 order in one pass: `editor/
> keymap.js` is the dispatcher, cards declare accents via the registry's
> `hotkeys` field, and every keyed control names its key in its hover
> title. §2's audit below describes the pre-implementation state this
> replaced (kept for the record). Awaiting Stew's browser verification.

---

## 1. Principles

1. **One hand on the keyboard, one on the mouse.** The mouse does the art
   (strokes, arranging, picking); the keyboard swaps the tool in your hand
   and fires the phase's primary action. No hotkey should require looking
   away from the canvas.
2. **Keys are mode-scoped, not global.** A key means one thing *in the
   current phase/mode* and can mean something else in another — like a
   darkroom where the same hand-motion does different work at different
   stations. A small dispatcher owns the routing (§7); no key ever has two
   meanings in the same context.
3. **Borrow conventions artists already have.** Where Photoshop/Krita have
   a near-universal binding (`[`/`]` brush size, `X` swap, digits for
   opacity, `V` move), use it. Familiar muscle memory beats a "logical"
   first letter.
4. **Never fight the browser.** No binding that a browser owns or that
   users reflexively press for browser reasons (§3). A hotkey that
   sometimes closes the tab is worse than no hotkey.
5. **Form fields always win.** The existing rule stays the backbone: while
   focus is in an input/slider/select, all app hotkeys are suppressed and
   native behavior (arrow keys nudging a focused slider) applies.
6. **Tone applies to keys too.** Any on-screen mention is studio language:
   a "Keys" reference, not a "controls" or "hotkeys menu" gamer overlay.

---

## 2. What was bound before the build (audit, kept for the record)

| Key | Context | Action |
|---|---|---|
| **Space** | WORKING, no card | Deal |
| **Enter** | phase-dependent | Primary action: End (placement/card), Deal (between rounds), Restart (Coda). *Deliberately never confirms the opening pick* — that choice must be explicit. |
| **R** | everywhere | Restart — **instant and destructive, no confirm** (see §5.1: recommend moving this) |
| **Cmd/Ctrl+Z** / **+Shift+Z** | placement + brush cards | Within-card brush undo/redo |
| **Shift+drag** (canvas) | any brush in hand | Resize brush, anchored circle preview (built 2026-07-05) |

Everything else on screen is mouse-only: mask mode icons, hardness toggle,
all sliders, undo/redo buttons, grid picks, Rack's flips, Etch's Zoom in,
layer reordering, "Open output folder".

---

## 3. The browser keyboard reality — what's actually available

Ranked by viability. The suppression rule (§1.5) already protects form
fields, so "safe" below means: safe when focus is on the page body, which
is Deck's normal state.

### Tier 1 — fully safe, use freely

- **Single letters** (except our own `R` until it moves): no browser
  meaning without a modifier. ~24 free slots. Best real estate we have.
- **Digits 0–9**: free. Photoshop trained artists that digits = opacity.
- **`[` and `]`**: free, and *the* brush-size convention.
- **`,` and `.`**: free. Natural "less / more" or "rotate left / right".
- **`-` and `=`**: free (browser zoom needs Ctrl). Natural minus/plus.
- **Escape**: safe; universal "back out / dismiss".
- **Arrow keys**: safe with `preventDefault` (they scroll pages by
  default; the editor layout doesn't scroll, so no loss).

### Tier 2 — safe with care

- **Shift + letter / digit / bracket**: no browser meaning. Doubles every
  Tier 1 slot; best used as "the bigger/inverse version of the unshifted
  key", never as an unrelated action.
- **Pointer-modifier gestures** (shift+drag is the precedent): safe while
  the app owns the canvas interaction. Alt+drag and Ctrl+drag are *not*
  clean (Alt fights Firefox's menu and Fabric's centered-transform;
  Ctrl+click is right-click on macOS).
- **Enter / Space**: already ours; extending their per-phase meaning is
  fine as long as each phase keeps exactly one meaning.

### Tier 3 — technically possible, mostly not worth it

- **Cmd/Ctrl + letter**: nearly all taken by the browser. Interceptable
  ones (S, P, D, F…) are rude to steal; muscle-memory ones are worse.
  **Cmd/Ctrl+Z/Shift+Z is the one family worth owning** (already do).
- **Alt combos**: Firefox menu activation on Windows/Linux; Option on
  macOS types special characters (needs `e.code` handling). Avoid.

### Never

- **Cmd/Ctrl+W, T, N, Q**: uninterceptable — will close/open tabs. Never
  bind, never bind anything *near* them in a combo users might fat-finger.
- **Cmd/Ctrl+R / F5**: page reload — loses the whole composition (the §8
  browser-tab invariant). Don't bind, and see §5.1 for the related plain-R
  problem.
- **F-keys**: fullscreen, devtools, OS-level captures.
- **Tab**: keyboard-focus navigation; taking it breaks accessibility.
- **`/` and `'`**: Firefox quick-find triggers. Avoidable risk — skip.
- **Backspace**: historical page-back reflexes; nothing gained.

---

## 4. The UI today, phase by phase — what could take a key

- **Opening pick** (grid of 24): click cycles place → stash → pass;
  Continue button. Keyboard adds little here — the choice *should* be
  slow and explicit (existing decision: Enter doesn't confirm).
- **Placement / stash return**: Arrange · Conceal · Restore · Soften mode
  icons; size + strength sliders; soft/hard toggle; undo/redo; layer
  reorder (rare, 2+ images); End.
- **Between rounds**: Deal (Space/Enter already).
- **Brush cards** — Silt, Dissolve, Bruise (reveal brushes) and the
  standing brush on Ghost, Stain, Stamp, Rails, Char: same brush grammar
  as placement plus per-card sliders (influence, radius, HSV, opacity,
  brightness/contrast, depth, dye/color).
- **Arrange-heavy cards** — Ghost/Stain/Stamp/Rails/Char in Arrange mode,
  Deeper's frame, Rack: free-transform manipulation (move/scale/rotate),
  Rack's Flip H / Flip V buttons.
- **Etch**: drag frame → Zoom in button → pixel brush (color, pixel size,
  undo/redo).
- **Grid cards** (Ghost, Stain, Stamp): pick one → confirm.
- **Coda**: export status; Open output folder; Start a new composition.

---

## 5. Proposed hotkey map

### 5.1 Global (all phases)

| Key | Action | Notes |
|---|---|---|
| **Enter** | Primary action | As today. Keep the opening-pick exception. |
| **Space** | Deal | As today. |
| **Shift+R** | Restart | **Change from plain R.** Restart destroys the piece with no confirm; a single unmodified letter is too cheap for it — and it sits next to the browser-reload reflex (Cmd/Ctrl+R), which also destroys the piece. Shift+R keeps it reachable but deliberate. Frees plain `R` for Restore (§5.2). |
| **Esc** | Contextual back-out | Deselect the active object in Arrange; clear the grid selection in a pick; otherwise nothing. Never ends/commits anything. |

### 5.2 The brush grammar (identical everywhere a brush exists)

The heart of the design. Learned once in the opening placement, it works
in every later brush context — standing mask brush and effect brushes
alike.

The mode row is **W · E · R · S** (decided with Stew, 2026-07-05): three
adjacent keys on the top row plus S directly below — the whole flow under
the left hand's resting position. Part of this change: **Conceal renames
to Erase** across the UI (mode label, hover title, hint copy) — E is its
key and its name.

| Key | Action | Notes |
|---|---|---|
| **`[` / `]`** | Brush size − / + | Steps of 5, ×2 with Shift held. Complements shift+drag: drag to land it, taps to fine-tune. Photoshop/Krita muscle memory. |
| **W** | Arrange mode | Only where Arrange exists (placement + image cards; effect brushes have nothing to arrange). |
| **E** | Erase (today's Conceal — renamed) | |
| **R** | Restore | Needs plain R freed (§5.1). |
| **S** | Soften | |
| **X** | Swap Erase ↔ Restore | Photoshop's foreground/background swap. The fastest correction loop: paint out too far, X, paint back, X. Complements E/R rather than replacing them. |
| **H** | Toggle Soft / Hard | One toggle, two states — a swap key, like X. |
| **Cmd/Ctrl+Z / +Shift+Z** | Undo / redo stroke | As today. |

### 5.3 Arrange mode (placement sessions + image cards' Arrange, Deeper's frame)

| Key | Action | Notes |
|---|---|---|
| **Arrow keys** | Nudge selected object 1px | `preventDefault`; Shift = 10px. The precision the mouse can't give. |
| **`,` / `.`** | Rotate −1° / +1° | Shift = 15° snaps. Reads left/right on the keycaps (`<` `>`). |
| **`-` / `=`** | Scale down / up ~2% | Shift = 10%. Around the object's center. |

These target the active/topmost placed object (Deeper: the frame rect).

### 5.4 Card-specific accents (declared per card, routed generically)

| Card | Key | Action |
|---|---|---|
| Rack | **F** / **Shift+F** | Flip H / Flip V |
| Etch | **Enter** | Advances the chain: frame placed → Zoom in (then End as usual) — Enter as "next step", consistent with §5.1 |
| Etch | **`[` / `]`** | Pixel size − / + (its own tiny scale) |
| Steep, Rails, Etch (any `color` control) | **N** | Re-roll a new random hue — extends the "color pickers open random" invariant into the session |
| Ghost / Stain / Stamp grids | **Enter** | Confirm once an image is taken (decided: allowed — a single-pick card grid is a smaller decision than the opening, which keeps its no-Enter rule) |

### 5.5 Deliberately unbound

- **Opening pick selection** — clicking through 24 thumbs with
  keyboard-grid navigation is more machinery than the moment wants. The
  opening should be slow.
- **Layer reorder** — only exists with 2+ images (opening placement,
  briefly); drag is fine. Revisit if multi-image sessions grow.
- **Coda screen** — the piece is finished; no need to speedrun the exit.
  Enter already restarts.
- **Digits 1–0 for Strength/Influence** — proposed (the Photoshop
  digits-for-opacity convention), decided against as overkill. Click a
  slider and native arrow keys already work; shift+drag and `[`/`]` cover
  the brush itself.

---

## 6. Collision check

- `R` Restore vs `R` Restart: resolved by moving Restart to Shift+R
  (§5.1). *This is the one breaking change to an existing binding.*
- `S` Soften vs Cmd/Ctrl+S: different modifier space; we never bind
  Cmd/Ctrl+S. Same for `W` vs Cmd/Ctrl+W — the plain letter is safe.
- `X`/`H` toggles vs typing: suppression rule covers form fields.
- Shift+drag (size) vs Shift+arrow/bracket (bigger steps): different
  input kinds, no overlap.
- Every key in §5 is Tier 1/2. Nothing touches the Never list.

---

## 7. Implementation sketch (built as described, 2026-07-05)

- One module, `editor/keymap.js`: a registry of `{ scope, key, run }`
  bindings with a single `keydown` listener. Scopes: `global`,
  `placement`, `brush`, `arrange`, `card:<id>`. Editor tells it the
  active scopes each render; first match wins, most specific scope first.
- The form-field suppression check moves into the dispatcher (one place,
  today it's inline in Editor's handler).
- Cards declare accents in their **registry entry** (`hotkeys: [...]`) —
  extends the registry shape generically, per the §5.2 CLAUDE.md rule; no
  per-card branches in Editor.
- Discoverability: each button/slider that has a key gets it appended to
  its hover `title` ("Erase — E"). Optionally later: a small "Keys"
  line or overlay, studio-toned. No modal tutorials.
- Brush-grammar keys route to the same state setters the sliders/buttons
  use (`onMaskControlsChange` / `setControl`), so the panel always
  reflects the keyboard — same pattern as shift+drag sizing.

## 8. Rollout order (all five landed 2026-07-05, one pass)

1. ✅ **Restart → Shift+R** (safety fix; unblocks `R`).
2. ✅ **Brush grammar** (§5.2) — highest use, one scope, teaches the system.
3. ✅ **Arrange nudge/rotate/scale** (§5.3).
4. ✅ **Card accents + registry `hotkeys` field** (§5.4).
5. ✅ **Hover-title discoverability**, and ✅ the "Keys" reference too
   (Stew asked for it same-day): a `keys` button in the header opens a
   centered overlay listing the whole map (`editor/KeysReference.jsx`).
   It's modal — while open it swallows the app's keys so Enter can't End
   behind it; Esc or a click closes it.

## 9. Decision record (Stew, 2026-07-05)

1. Restart moves to **Shift+R** — agreed.
2. Digits for Strength/Influence — **rejected, overkill** (moved to §5.5).
3. Enter confirms a *card* grid pick — **allowed** (opening keeps its
   no-Enter rule).
4. `,`/`.` rotate and `-`/`=` scale — **kept**.
5. `N` re-rolls a color — **kept** ("delightful").
6. No other keys requested.
7. (Revision round) Mode row is **W·E·R·S**, replacing the proposed
   V/B/C/R/S; **Conceal renames to Erase** across the UI.
