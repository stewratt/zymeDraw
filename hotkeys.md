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
  the app owns the canvas interaction. Alt+drag is *not* clean (it fights
  Firefox's menu and Fabric's centered-transform). **Ctrl+drag was listed
  here as unclean too, and is now bound anyway** (pan, §5.6/issue #72):
  the objection was that Ctrl+click is right-click on macOS, which we
  answer by accepting `ctrlKey || metaKey` — Mac hands pan with Cmd — and
  suppressing the canvas context menu while either is held. The exception
  earns itself because the modifier is *already* the zoom key: it makes
  one navigation modifier instead of a second, unrelated binding.
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
| **Enter** | Primary action | The deck click from the keyboard: it commits the round *and* turns the next card, in every phase that can advance (§5.7, issue #87). Keep the opening-pick exception. Space moved to pan (§5.6, issue #53). |
| **Cmd/Ctrl + drag** | Pan the canvas | The canvas-navigation modifier: same key as the zoom, and the same gesture the 3D room already answers to (§5.6, issue #72). |
| **Hold Space + drag** | Pan the canvas | Photoshop's grab hand, kept as an alias for the muscle memory. Space is no longer Deal — it's a pan-hold everywhere the working canvas is live (§5.6). |
| **Cmd/Ctrl + scroll** | Zoom toward the cursor | Clamped 0.5×–8×; plain scroll does nothing (§5.6). |
| **0** | Reset the view to fit | The escape hatch for a zoomed/panned view. A free digit — 0 = "reset" in image editors; the only other bound digit is C at the Coda (§5.6). |
| **Shift+R** | Restart | **Change from plain R.** Restart destroys the piece with no confirm; a single unmodified letter is too cheap for it — and it sits next to the browser-reload reflex (Cmd/Ctrl+R), which also destroys the piece. Shift+R keeps it reachable but deliberate. Frees plain `R` for Restore (§5.2). |
| **Esc** | Contextual back-out | Deselect the active object in Arrange; clear the grid selection in a pick; otherwise nothing. Never ends/commits anything. |

### 5.6 Canvas zoom / pan (issue #53, added 2026-07-18)

Work closer or farther for fine detail while placing or brushing. The lens
moves **only** the visible proxy's `viewportTransform` — never the master
raster, the bake, or the export (`editor/canvasNav.js`, one shared module
attached to the canvas by Editor).

| Key / gesture | Action | Notes |
|---|---|---|
| **Cmd/Ctrl + drag** | Pan | Same handler as the Space hold. Arms on *keydown*, not mouse-down — Fabric resolves what a press hit before it emits `mouse:down`, so arming any later would already have grabbed the object underneath. |
| **Hold Space + drag** | Pan | Grab-hand cursor; object selection/drag suspended while either hold is down so a pan never moves a piece, restored on release. Holding alone never clears the selection — only an actual pan does, so Cmd/Ctrl+Z leaves it be. |
| **Cmd/Ctrl + scroll** | Zoom to cursor | `zoomToPoint`, clamped 0.5×–8×. `preventDefault` on the wheel only while the modifier is held. |
| **0** | Reset to fit | Also reset automatically on every deal/End/phase transition. |

**The one breaking change:** Deal moves off Space entirely and is
**Enter-only** in every phase, freeing Space for the pan-hold. (The two-press
rhythm this preserved was itself retired later — see §5.7.)

**Viewport safety.** A leaked zoom/pan would bake wrong (CLAUDE.md §6:
`toCanvasElement` bakes through the viewport). The universal bake now resets
the viewport to identity before it snapshots (`masterRaster.bake`), so every
End/commit is baked from the true unzoomed proxy no matter what left the view
transformed. Etch already owns the viewport for its own zoom session; Editor
suspends the global nav while any card with `ownsViewport` is live so the two
never fight, and re-enables it when the card is gone.

### 5.7 The deck is the button (issue #87, added 2026-07-26)

The two-press rhythm is retired. There is no End button and no Deal button:
a deck of card backs sits at the foot of the right panel and **one click on
it commits the round and turns the next card**, which flips face-up in the
slot beside it. The flip is the turn separator the second press used to be.

| Key / gesture | Action | Notes |
|---|---|---|
| **Click the deck** | Commit + deal | Placement, the stash return, and every card round alike. From the waiting beat (nothing in hand) it simply deals. |
| **Enter** | The same, from the keyboard | One binding for every advancing phase (`handleAdvance` in Editor). Still never confirms the opening pick; the Coda keeps its own click-only choice (§9.9), and the stash-return notice keeps its click-only acknowledgement. |

Scope note: the deck is not the exit at the Coda — nothing follows it, so
COMPLETE keeps Enter on "start a new composition".

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
| Lift | **Esc** | Discards a copy in hand (or clears a marquee mid-drag) — the §5.1 back-out, extended; with nothing in progress the key passes along |
| Steep, Rails, Etch (any `color` control) | **N** | Re-roll a new random hue — extends the "color pickers open random" invariant into the session |
| Ghost / Stain / Stamp grids | **Enter** | Confirm once an image is taken (decided: allowed — a single-pick card grid is a smaller decision than the opening, which keeps its no-Enter rule) |

### 5.5 Deliberately unbound

- **Opening pick selection** — clicking through 24 thumbs with
  keyboard-grid navigation is more machinery than the moment wants. The
  opening should be slow.
- **Layer reorder** — only exists with 2+ images (opening placement,
  briefly); drag is fine. Revisit if multi-image sessions grow.
- **Coda screen** — the piece is finished; no need to speedrun the exit.
  Enter already restarts. *(Amended 2026-07-06: the plinth now takes
  **C** — leaf through the session's states, see §9 item 8 — but the
  no-speedrun principle stands; nothing else gets a key here.)*
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
8. (2026-07-06) **C** at the Coda leafs the plinth through the session's
   committed states (the v4 state cache, notes §9) and back to the piece.
   The Coda screen's one key; Tier 1, no collisions (the brush grammar's
   scopes never coexist with the plinth).
9. (2026-07-06) The Coda choice while Delay is held (notes §5.9) is
   **click-only** — no Enter, no keys. Enter deals and commits everywhere
   else; neither ending the piece nor refusing the ending may ever be a
   double-press accident. Same manners as Skim's turn.
10. (2026-07-18, issue #53) **Canvas zoom/pan** (§5.6). Deal moves off
    Space to **Enter-only**; **Space becomes the pan-hold**; **Cmd/Ctrl +
    scroll** zooms to the cursor; **0** resets the view. The lens touches
    only the on-screen proxy — the bake resets the viewport first, so the
    committed pixels are never shifted. Etch keeps its own zoom; the global
    nav steps aside (`ownsViewport`) while it's live.
11. (2026-07-19, issue #72) **Cmd/Ctrl is the canvas-navigation key.**
    **Cmd/Ctrl + drag** now pans, joining the scroll-zoom already on that
    modifier; **Space + drag stays** as an alias rather than being
    replaced, because the Photoshop habit costs nothing to keep. This
    knowingly overrides the Tier 2 "Ctrl+drag is not clean" note — see the
    rationale recorded there. It also makes the 2D canvas and the Coda's
    3D room answer to one habit: OrbitControls already reads modifier+drag
    as pan, plain drag as orbit, so nothing changed on the 3D side.
    Two implementation notes worth keeping, both learned the hard way:
    the hold arms on **keydown**, never at mouse-down (Fabric decides what
    a press hit before it emits `mouse:down`, so arming later means the
    press already grabbed an object); and holding the modifier must be
    **non-destructive** — clearing the selection on arm would make every
    Cmd/Ctrl+Z deselect what you were working on, so only a real pan
    clears it.
12. (2026-07-26, issue #87) **The deck is the button** (§5.7). The
    two-press rhythm (End, then Deal) is **retired**: one click on the deck
    commits and deals, and the drawn card's flip marks the turn boundary —
    which is what the second press was really for. Enter keeps its place as
    the same action from the keyboard, now bound once for every advancing
    phase instead of one branch per phase. The two click-only beats stand:
    the Coda choice and the stash-return notice.
