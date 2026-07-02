# Deck v2 — Redesign plan of attack

> Response to `design_changes_july2.md`. This is the working plan for the v2
> redesign. Nothing here is code yet — Phase 0 locks the open decisions with
> Stew before any implementation starts, per the working agreement (CLAUDE.md §2).

---

## 0. Decisions — locked with Stew 2026-07-02

1. **Deck model → literal finite shuffled deck. CONFIRMED.** Session start
   builds an actual card list (each card has a copy count), shuffles it, and
   deals from the top. "Shuffling death cards in" is a real deck operation and
   repeats are bounded by copy counts. **Design goal on top of this:** grow
   the card library over time until sequences feel pretty unique each session.
   Cards are *named, opinionated chains of events* ("Ghost" names a specific
   sequence); variants are welcome — a card may share another's chain with one
   deliberate alteration.
2. **Death card → instant end, no final modification. CONFIRMED.** Drawing it
   means the piece is finished: straight to export. Frame / Final Grade /
   Grain Finish are removed (grain and grade survive as midgame brush/global
   cards instead). **Open variant to explore:** a "death crop" — the death
   card offers one final *crop/framing* choice (not a modification) before
   export; possibly *all* death cards are crop cards. Decide once the ending
   is playable (Phase 1 mechanics, Phase 11 tuning).
3. **rembg + Real-ESRGAN → Python sidecar service. CONFIRMED.** One small
   FastAPI process hosting both models, auto-started by `npm run dev`, proxied
   by Express. Cards degrade gracefully when it's down (stamp → manual erase
   cutout; deeper → plain resample).
4. **Dice system → in-app rolls, dice-styled. STILL ASSUMED** (not explicitly
   confirmed). Rolls happen digitally with a visible roll/reveal moment; cards
   carry printed numbers. The data model is designed so a "manual entry" mode
   (you roll physical dice and type the result) can be added later without
   rework. Cheap to change until Phase 3's roll UI is built.

One naming note per the §1 tone invariant ("not a game"): *death card* is a
great design term but reads gamey on screen. Suggested display name: **"Fin"**
or **"Coda"** — the mechanic is unchanged. Decide at Phase 1.

---

## 1. Assessment: what the redesign means for the current build

### Survives as-is (the good bones)
- **The registry/lifecycle pattern** (`registry.jsx`, one file per card,
  `begin/update/commit/cleanup`, no per-card branches in Editor/DeckPanel).
  This is exactly the right shape for the new cards too.
- **`deck.js` purity** — the state machine gets rewritten (see §3) but stays a
  pure reducer with no Fabric/DOM knowledge.
- **Backend + Setup flow** — folder config, image listing/serving, export
  route, open-output. All still needed; the backend grows (ML proxy, random
  image sampling) but keeps its "hands, not brain" role.
- **UI chrome** — card-flip animation, keyboard shortcuts, tone-cleaned copy.

### Dies (delete, don't preserve)
- **Add 1/2/3 cards** → replaced by the opening rolls + grid pick.
- **The entire layers infrastructure**: `LayersPanel.jsx` (all four modes,
  including the Phase 8 reorder work), `layers.js`, `deckId/deckLabel/deckKind`
  tagging, `layerKinds`, `targetLayerId`. With flatten-on-End there is exactly
  one committed layer at all times — there is nothing to list, target,
  reorder, or remove. This is the single biggest simplification in the
  codebase.
- **Cards made meaningless by one-layer world or the "no card just *does*
  something" rule**: Shuffle Layers, Remove Layer, Flatten (flatten *is* End
  now), Flip Canvas (folds into Reposition), Eraser-as-a-card (erasing becomes
  a universal placement-time tool, not a draw).
- **Endgame finishers** (Frame, Final Grade, Grain Finish) — per the
  instant-end assumption above.
- **Grade presets** — replaced by the global color cards with full control.

### Transforms (concept survives, implementation is new)
| Old | New |
|---|---|
| Zoom & Flatten | **Deeper** — user-chosen crop/zoom/rotate + ESRGAN 4x detail |
| Layer HSV | **HSV** global card with strength slider + **HSV brush** |
| Layer Blur | **Blur brush** |
| Canvas Grain | **Noise brush** |
| Pencil (retained code) | Base reference for the universal brush core |
| Eraser (`@erase2d/fabric`) | Reference for destructive stroke commit; the new erase is mask-based and may not need the library at all |

---

## 2. The three new architectural pillars

These are the load-bearing decisions. Everything else is card-by-card work.

### 2.1 The bake engine (flatten on every End)

**Rule: the canvas state when you press End becomes a single flattened image.
No objects survive between cards.**

- Editor's `handleCommit` gains one generic step after the card's `commit`
  hook: rasterize the whole canvas, clear it, and place the result as the one
  base image. No card implements flattening; it's universal.
- This *replaces* the layers panel, tagging, and target-picking entirely.
- The card lifecycle contract simplifies: a card's job is to set up temporary
  objects/tools during its session; the bake makes everything permanent
  identically for every card.

**The resolution decision that comes with it (the one real risk):** today the
canvas works at 800×1000 and exports at 3× via `toDataURL({multiplier: 3})`.
That trick dies the first time we bake — once pixels are flattened at 800×1000,
a 3× export is just a blurry upscale, and every subsequent bake degrades it
further. And Deeper's crop-then-upscale loop makes resolution management the
core of the tool.

**Proposed: a master raster.** The true image lives offscreen at export
resolution (2400×3000). The visible Fabric canvas is a working proxy at
800×1000 showing the master scaled down. Every bake renders at 3× and *that*
becomes the new master. Brush masks are painted at display resolution and
scaled up when applied (soft masks upscale gracefully). Deeper crops the
master and ESRGAN restores the crop to master resolution. Export = write the
master, no multiplier, which also kills the WebGL-texture-cap export bug in
CLAUDE.md §10.

This is Phase 2's check-in topic — it's the "clever/unfamiliar technique"
that §2 of CLAUDE.md says we pause on.

### 2.2 The session script (deck.js v2)

New pure state machine. Sketch of the state shape:

```js
{
  phase: 'OPENING_ROLLS' | 'OPENING_PICK' | 'PLACEMENT' | 'WORKING'
       | 'STASH_RETURN' | 'COMPLETE',
  rolls: { gridSize, pickCount },        // the two opening rolls
  stash: ['file1.png', ...],             // filenames held for later
  deck: [cardId, ...],                   // the literal shuffled deck
  roundsDealt: number,
  script: { actOneRounds, actTwoRounds, deathCount },  // per-session tuning
  currentCard, history                   // as today
}
```

Session flow (numbers are the tunable knobs, all in one place):

1. **Opening rolls.** Grid roll (8–16; e.g. `8 + d8`) and pick roll (2–4;
   e.g. `1 + d3`) — dice-expressible so the physical mode stays possible.
2. **Opening pick.** Backend serves `gridSize` random images from the input
   folder; you select `pickCount`; of those, choose per-image **place now** or
   **stash**. At least one must be placed.
3. **Placement.** Arrange the placed image(s): move/scale/rotate + the
   always-on hard/soft erase brush (§2.3). End bakes.
4. **Act I.** Deal ~4 cards from the shuffled modification deck, one round each.
5. **Stash return.** Forced event (skipped if stash is empty): stashed images
   come back as a placement session — same tools as step 3.
6. **Act II.** Deal ~2 more rounds, then shuffle 2–3 death cards into the
   remaining deck. Keep dealing. Death odds rise naturally as the deck thins.
7. **Death card → COMPLETE.** Export the master. Finished, not "won".

`deck.js` stays pure: it holds filenames and card ids, never images or Fabric
objects. Fetching the grid is Editor's job, reported back via actions.

**Deck composition (first draft, tune in playtesting):** Ghost ×2, Stamp ×2,
Deeper ×2, Noise brush ×1, Blur brush ×1, HSV brush ×1, Color Overlay ×1,
Global HSV ×1, Reposition ×1, Rails ×1 → 13-card mod deck, ~6–8 of which are
seen per session. One array literal to rebalance.

### 2.3 The universal brush core

One shared module (grown out of `pencil.jsx`'s role as brush base), used by
everything:

- **Hard/soft round brush**: stamped dabs (radial-gradient for soft), with
  size / opacity / flow controls.
- **Strokes paint into an offscreen grayscale mask canvas**, never directly
  into image pixels — so:
- **Within-card undo/redo** is a stroke stack on the mask. Free, and it never
  crosses an End (commitment stays absolute).
- **Two consumers, same infra:**
  - **Erase mode** (always available whenever images are being placed —
    opening placement, stash return, Ghost, Stamp): mask = the placed image's
    alpha. This replaces `@erase2d/fabric`; destructive at bake time.
  - **Effect mode** (Noise / Blur / HSV brushes): exactly the architecture the
    design doc proposes — duplicate the canvas, apply the effect to the copy
    at full strength, fully mask it out, and painting *reveals* the effected
    copy through the mask. On End the composite bakes. This is also CLAUDE.md
    §14's "masked bake" path (A) — the design doc and the earlier Phase 9
    research converged on the same answer independently.

### 2.4 (Supporting) The ML sidecar

- `backend/ml/` — a small FastAPI app: `POST /cutout` (rembg),
  `POST /upscale` (Real-ESRGAN 4x), `GET /health`. Models lazy-load on first
  use and stay warm.
- Express proxies `/api/ml/*` and exposes sidecar health; `npm run dev` gains
  a third `concurrently` entry. One-time per-machine setup: a Python venv +
  `pip install` (documented in README; works CPU-only, GPU just makes it
  faster).
- **Graceful degradation is a requirement, not a nicety**: sidecar down →
  Stamp becomes "place + erase your own cutout", Deeper becomes plain
  resample. The session never blocks on ML.

---

## 3. The card set (target state)

| Card | Copies | One-line behavior | Key tech |
|---|---|---|---|
| **Ghost** | 2 | Grid of 8 → pick 1 → placed in `screen` blend; opacity, brightness/contrast, erase; End bakes | blend via `globalCompositeOperation`, brush core |
| **Stamp** | 2 | Grid of 6 → pick 1 → rembg cutout placed; scale/rotate/opacity + erase | ML sidecar |
| **Deeper** | 2 | Choose crop/zoom/rotate region; commit re-frames the whole canvas; ESRGAN restores detail | master raster + ML sidecar |
| **Noise brush** | 1 | Paint grain locally; intensity/size/opacity, undo/redo | effect-mask infra |
| **Blur brush** | 1 | Paint blur locally; same controls | effect-mask infra |
| **HSV brush** | 1 | Paint an HSV shift locally | effect-mask infra |
| **Color Overlay** | 1 | Global tint: color picker + 0–100% influence | Fabric filter or 2d composite |
| **HSV (global)** | 1 | Whole-canvas HSV with a strength slider (the "quantity of influence" control) | Fabric filters + blend-back |
| **Reposition** | 1 | Flip H/V, rotate, zoom the whole canvas — your call within the constraint | canvas transform + bake |
| **Rails** | 1 | Random image → edge/palette-clamped alpha cutout, solid color, scale + opacity + erase; stamp it on | pixel op (sidecar or canvas2d) — needs a prototype |
| **Fin/Coda (death)** | 2–3, shuffled in during Act II | The piece is complete; export. (Open: may offer one final crop — see §0.2) | — |

Every modification card passes the design doc's test: *constraint outside,
freedom inside* — none of them "just does something to your image."

---

## 4. Phases

Per the working agreement: one phase at a time, checkpoint + plain-language
concept summary + browser test steps at the end of each, wait for "continue."
Order within Phases 5–10 is swappable if playtesting wants a card sooner.

- **Phase 0 — Lock the plan (no code).** Confirm/overturn the four §0
  decisions and the §2.2 pacing numbers. Commit `design_changes_july2.md` +
  this plan. Rewrite CLAUDE.md for v2 (the current §0 resume notes are stale —
  Phase 8 and the tone cleanup are already committed). All v2 work happens on
  a `v2` branch.
- **Phase 1 — deck.js v2.** The full new state machine (rolls, literal deck,
  stash, script, death) as a pure reducer, driven by placeholder cards and
  minimal UI so the *entire* new session arc is clickable end-to-end before
  any real card exists. This is where pacing gets cheap to tune.
- **Phase 2 — Bake engine + master raster.** The universal flatten-on-End and
  the offscreen master (check-in on §2.1 before building). Delete the layers
  infrastructure and obsolete cards. Export = write the master. After this
  phase the codebase is *smaller* than it is today.
- **Phase 3 — The opening.** Roll reveal UI → image grid (backend endpoint
  for a random sample) → pick → place-or-stash → placement session. Includes
  **Phase 3b: the brush core in erase mode** (hard/soft, undo/redo), since
  placement is its first consumer.
- **Phase 4 — Effect-brush infra + Noise brush.** The duplicate-mask-reveal
  pipeline, proven with one card. Riskiest new canvas tech, so it goes early.
- **Phase 5 — Brush + global replication.** Blur brush, HSV brush (small
  files on Phase 4's infra); Color Overlay, Global HSV, Reposition.
- **Phase 6 — Ghost.** First multi-sequence card: fresh grid → screen blend →
  opacity/brightness/contrast + erase. Reuses Phase 3's grid and brush.
- **Phase 7 — ML sidecar.** FastAPI service, proxy, health check, README
  setup docs for all three machines, degradation paths verified.
- **Phase 8 — Stamp.** Grid → rembg cutout → place/scale/rotate/opacity/erase.
- **Phase 9 — Deeper.** Crop/zoom/rotate UI → bake re-frame → ESRGAN detail
  restore into the master. Depends hard on Phases 2 + 7.
- **Phase 10 — Rails.** Prototype the edge/palette-clamp alpha technique
  first (likely in the sidecar with OpenCV/PIL, possibly pure canvas2d),
  check in on the look, then build the card.
- **Phase 11 — Tuning + polish.** Playtest sessions; tune deck composition,
  act lengths, death count in `deck.js`; roll/deal presentation polish; tone
  pass over all new copy; final CLAUDE.md update; merge `v2`.

Rough shape: Phases 1–3 rebuild the skeleton, 4–6 make it playable with real
cards, 7–10 add the ML-powered signature cards, 11 makes it good.

---

## 5. Open items parked for their phase

- Exact dice mapping for the rolls (Phase 1): e.g. grid `8+d8`, pick `1+d3` —
  pick dice that feel good physically.
- The death-crop variant (§0.2): plain instant end vs. one terminal crop
  choice vs. all death cards being crop cards. Playtest the plain version
  first (Phase 1), decide in Phase 11.
- Whether stash-return places all stashed images in one session or one per
  round (Phase 1; current lean: one session, like the opening).
- `screen` blend + WebGL filter interaction in Fabric 6 needs a quick spike
  (Phase 6) — verify `toDataURL` respects `globalCompositeOperation` with
  filters active on the same object.
- Rails' visual recipe (Phase 10) — edge detection vs. luminance threshold vs.
  posterize-and-key; needs eyes on real output before committing.
- Real-ESRGAN model choice (Phase 7): `realesrgan-x4plus` vs. the lighter
  `realesr-general-x4v3`; and CPU latency tolerance per machine.
