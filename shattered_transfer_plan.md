# Shattered Transfer — build plan (style-transfer branch, step 3)

> The advanced style-transfer card: an image becomes a stencil, and the
> style transfer shows through only where the stencil's shattered form
> sits. Companion to `transfer.jsx` (the whole-canvas version, step 2).

## The card, as played

1. **Pick** — a grid of 6 is dealt (CardGridPicker, like Stamp). Take one:
   it won't be placed as pixels, it will be *read* as a stencil.
2. **Shatter** — the chosen image is read for its most shattered form
   (Rails' exact machinery: threshold / posterize-band / edge-map
   candidates, scored by fragment count). Its mask becomes the stencil.
3. **Arrange** — the stencil is placed as a free-transform object
   (move / scale / rotate, like Stamp). Meanwhile, from the moment the
   card began, the sidecar has been redrawing the whole piece in the
   transfer style *in the background* — by the time you're arranging,
   it's usually ready.
4. **The window** — once the transfer lands, the stencil stops being a
   flat preview and becomes a *window*: wherever its fragments sit, the
   styled redraw of what's underneath shows through. Dragging the stencil
   sweeps the window across the piece — the judgment is where the style
   is allowed to break through.
5. **Erase + influence** — the standing erase brush (toggle Arrange/Erase,
   like Stamp) trims the styled fragments; erase marks live on the piece,
   so they stay put if the stencil is re-arranged afterwards. An
   influence slider sets how strongly the styled layer sits.
6. **End** — universal bake. Nothing new to implement.

## Architecture

One new card file, `cards/shatteredTransfer.jsx`, plus two small shared
extractions (no Editor/DeckPanel changes):

- **`editor/shatter.js`** — extract Rails' mask machinery
  (`computeLum`, `maskFor`, `pickMostShattered`, `maskToCanvas`,
  reading labels). Rails imports it back; behavior unchanged.
- **`editor/styleTransfer.js`** — extract `fetchStyledCanvas` from
  `transfer.jsx` (health check → master at INPUT_WIDTH → `/api/ml/style`
  → canvas element). Both transfer cards import it.

### The compositing model (the one new idea)

A single full-canvas overlay image (like Transfer's), whose composite is
rebuilt from three layers, all at the styled canvas's resolution:

```
composite = styled pixels
          ∩ windowMask        (stencil mask, stamped at its current
                               canvas transform — redrawn on every
                               move/scale/rotate of the stencil object)
          − erase strokes     (committed mask + live stroke, exactly
                               brushCore's erase composite)
```

- The stencil object itself renders as a near-invisible handle (its
  fragments at low alpha so it can be grabbed and read); the *content*
  is always painted by the overlay. Before the transfer lands, the
  overlay isn't there yet, so the low-alpha fragments double as the
  "flat preview" of stage 3.
- The erase strokes need brushCore's stroke engine attached to a custom
  composite (window ∩ styled), which `createEraseSession` can't express —
  so `createStrokeEngine` gets exported from brushCore and the card
  provides its own ~40-line consumer state, following the erase
  consumer's shape. brushCore's "two consumers" comment gets updated.
- Cost check: re-stamping the window mask on drag is two `drawImage`
  calls per frame at 1200×1500 — same order as Rails' native-res tint,
  fine on canvas2d.

### Sequencing inside `begin` (all existing patterns)

```
begin:
  styledPromise = fetchStyledCanvas(master)   // fire immediately, no await
  files = sampleImages(6); chosen = await pick  // Ghost/Stamp pattern
  load chosen → shatter (Rails recipe) → maskCanvas
  place stencil object, arrange mode, report stage 'arrange'
  styled = await styledPromise                 // usually already resolved
  build overlay + stroke engine; report stage 'work'
```

`begin` doesn't return until the transfer resolves, so End stays disabled
through the wait for free (the Ghost/Stamp contract). Arranging is live
the whole time.

### Degradation (mandatory)

Sidecar down / transfer failed → no styled pixels exist, so the card has
nothing to give: the stencil preview is removed, the panel says the
transfer service is unavailable, End moves on (bake of the untouched
master is a no-op). Same posture as Transfer.

### Registry / deck

- Registry: `shatteredTransfer` — controls `opacity, mode, size,
  hardness, strength`; `Overlay` = the grid pick (CardGridPicker);
  `begin/update/commit/cleanup` per the Stamp shape.
- Deck: `{ id: 'shatteredTransfer', label: 'Shattered Transfer',
  copies: 2 }` (tuning later, with the rest of the deck).

## Open choices (checked with Stew before building)

1. **Live window vs. set-then-erase.** Plan says live window (arrange and
   the styled content shows through in real time, re-arrangeable after
   erasing). The simpler fallback — lock the stencil with a "Set" press,
   then erase a static cutout — only worth it if the live redraw stutters.
2. **Stencil reading: auto most-shattered (Rails' rule) vs. offering the
   three readings (darks / midtones / edges) as a choice.** Auto keeps the
   card opinionated and the panel clean; the choice adds judgment but
   overlaps Rails less. Plan assumes auto.
3. **Grid of 6 pick vs. random deal.** Stew's notes say "picking the
   image", so: grid of 6.

## Not in scope

- Multiple stencil stampings per card (one stencil, endlessly
  re-arrangeable, is the constraint).
- Style choice UI — STYLE stays a module constant until home-trained
  models exist.
- Tint/color on the fragments (that's Rails' land).
