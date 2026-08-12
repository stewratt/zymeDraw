# The card line — new cards + the deck builder

> Written 2026-07-08. **This is the card line** — new cards drawn from a
> Kid Pix exploration, and, once the card count demands it, a deck-builder
> menu. No longer a "version," just a named chunk of work you can pick up
> in any order relative to the infrastructure line (`app_plan.md`, the
> glue / ZYME / packaging plan); the two share the repo, not a dependency.
>
> Companion to CLAUDE.md §0 and `card_anatomy.md` — every card below
> gets a full §9 card sheet before its code, per the contract.
> Itemized as GitHub issues (label `card-line`, #12–#16; the inherited
> backlog below is `parked`, #18–#28); this doc is the rationale the
> issues point back into.

---

## 0. Where this starts

`main` (= this branch's base) holds the 20-mod + 3-Coda deck.

**Inherited backlog** — the still-live card-design threads from the v4
design docs (now under `archive/`, since v4 shipped): the **descent
experiment** (1 Deeper dealt + 2 held in reserve, descents dilute the deck
— `archive/v4_design_notes.md` §8.2, tabled), **mid-state pulling** (export
a middle state; capture already ships, the pull decision stays open — §9.3),
**death-crop** (a terminal crop at the Coda — §6.5), and from the v3 doc
**suits**, **Echo**, and **Mount** (`archive/version_3_design.md`). These
stay live; this line doesn't replace them, it grows the pool the same way —
one card at a time, checkpointed, verified in the browser before commit.

**The source**: Kid Pix. Its brushes are a catalog of exactly the kind
of move Deck wants — concrete, physical, a little unruly, and always
*driven by the hand*. Three of its tools map onto cards almost directly
(the stamp brush, the truck brush, the blender's displacement family),
and looking at Deeper through Kid Pix eyes suggested a fourth (Closer —
the zoom that stays honest about its pixels).

**The register warning, up front.** Kid Pix is a toy and it *sounds*
like one. The moves come over; the affect does not. Every name below is
a candidate list, not a decision — names are copy (free to drift), but
each card's **id** is permanent and gets chosen deliberately when the
name settles (`card_anatomy.md` §5 item 0). No card ships with a
toy-register name.

---

## 1. The seam these cards share

All four cards work **the piece's own pixels** (or a cutout's) as
material — copying, lifting, scattering, magnifying. That's a different
seam from most of the current deck, which brings *outside* images in
(grafts) or washes color over the whole. Kid Pix's insight is that the
canvas itself is the richest source image you have. Two consequences:

- **Late-session cards.** These moves get better the more the piece has
  accumulated. Worth remembering at balance time — a lift on a blank
  canvas does nothing. (No mechanic needed; just a note for copy counts
  and, later, archetype design.)
- **Two framework extensions.** `brushCore.js` today has two stroke
  engines: mask sessions and reveal sessions. The stamp brush and the
  lift brush each want a third kind of session (§2, §3). That's the real
  cost of this wave — the cards themselves are thin once the engines
  exist, and the fracture family (§4) inherits them.

---

## 2. Card: the stamp brush

*Built 2026-07-12 as **Reverberate** (issue #14) — pool-only at 0
copies, verified in the browser. The section stays as the design record.*

*Kid Pix reference: the stamp used as a brush — a chosen sprite laid
down in repeated impressions along the stroke path (see the cactus
screenshot: one stamp, dragged, becomes a braided rope of copies).*

- **The constraint**: one image fragment, repeated. You choose the
  stamp once; the round is spent drawing with it.
- **The freedom inside**: everything — where, how dense, how large, how
  the copies overlap and braid. This is the most brush-like card in the
  batch; constraint-outside-freedom-inside is trivially satisfied.
- **The stamp itself**: reuse Stamp's chain — grid of 6, take one, the
  sidecar cuts the subject out (`fetchCutoutUrl` in `stamp.jsx`), and
  the degraded path (sidecar down → full image as the stamp) comes for
  free. Open design question (§8): should the stamp *alternatively* be
  a fragment of the piece itself? That version is a different card —
  park it for the fracture family (§4), keep this one outward-facing.
- **Machinery**: **new stroke engine** — a *stamp session* in
  `brushCore.js`: on stroke, lay impressions of a source bitmap at
  spacing intervals along the path, at master resolution. Controls:
  `size` (bracket keys for free), spacing/density, opacity, maybe
  per-impression jitter (size/rotation wobble — the Kid Pix charm is
  that the rope isn't perfectly regular). Within-card undo/redo per
  stroke, same as the other brushes.
- **Chain**: Graft (cutout) × stamp brush — a chained card on a new
  primitive.
- **Names on the table**: *Straw* (Stew: "stampdraw"), *Reverberate*
  (Stew), and one near-neighbor worth saying out loud: **Strew** — a
  real process word meaning "scatter loosely over a surface," one
  letter from Straw and dead-center in the zyme register. Also in the
  register's key: *Sow*. Stew picks; the id follows the pick.
  **Picked 2026-07-12: Reverberate** (id `reverberate`).

---

## 3. Card: the lift brush (the truck)

*Kid Pix reference: the truck tool — a rectangle of the canvas grabbed,
dragged, and set down elsewhere. A smudge brush with no smudge: cut,
move, drop.* (**The smudge itself arrived 2026-08-12 as Smear**, issue
#123 — `editor/smearSession.js`, a new primitive. The two are siblings
now: Lift relocates pixels intact, Smear drags them until they blend.)

- **The constraint**: relocation only. Nothing new enters the piece;
  nothing is painted; pixels change *address*, not value.
- **The freedom inside**: what to take, where to put it, how many times.
  Multiple lifts per round — each grab-drag-drop is one gesture, and
  the round is a series of them.
- **Machinery**: **new session kind** — a *lift session*: press-drag
  defines the region (rect to start), on release the region's master
  pixels lift into a floating Fabric image that follows the cursor;
  click sets it down. The vacated space fills with the ground color
  (white, matching Deeper's outside-frame fill) in v1.
- **The hole** (Stew's "something is created in the space left behind"):
  deliberately deferred, but the design space is noted — the vacancy
  could fill with a blur of its surroundings, a solid sampled from the
  lifted region's average, a rembg-style inpaint if the sidecar ever
  grows one, or the *previous state* showing through (which would make
  the lift an excavation — ties into the v4 notes' mid-state-pulling
  idea §9.3). v1 ships the honest white hole; the hole's contents can
  become a **variant card** later rather than a control (one card =
  one behavior; a "hole mode" dropdown is settings-menu thinking).
- **Region shape**: square/rect default (Kid Pix's default). A cutout-
  shaped lift (rembg finds a subject *in the piece* and the lift takes
  exactly that) is the natural rare-tier upgrade — noted in §4.
- **Names on the table**: *Trucker*, *Leaf*, *Displacer* (Stew).
  Register readings: Displacer is a settings-menu label; Trucker is an
  agent-noun with arcade adjacency; Leaf is oblique but lovely (leafing
  through, gold-leafing onto a surface). Register-fit process words to
  weigh alongside: **Lift** (a real printmaking/watercolor term — paint
  *lifted* off the sheet), *Haul*. Stew picks.
  **Built 2026-07-10 (issue #13) as Lift, id `lift`** — the register
  reading's own lean, adopted as the suggested answer. The name stays
  free to drift (one `uiText.json` edit); the id is cut.
  **Pivoted during PR review (2026-07-10): the truck became a clone
  stamp.** Rather than lifting a rectangle free and leaving a white hole,
  the gesture now *copies* the rectangle and stamps the copy elsewhere —
  the source is untouched, nothing is removed. Off-edge placement crops
  the copy on commit (the source is preserved, so no unique pixel is
  lost). The white-hole "lift" and its inpaint/excavation variants above
  are now unbuilt design space, not the shipped card. The name "Lift" may
  want to follow the concept (clone/print/twin register); Stew's call.

---

## 4. Family: the fractures (rare tier, one exemplar first)

*Kid Pix reference: the blender tool's displacement modes — fragments
of the drawing broken out, duplicated, and strewn across the surface
(see the blue screenshot: the piece eaten by tiled copies of its own
regions).*

- **What it is**: not one card — a **design family**. Each fracture
  card takes fragments of the piece and redistributes them. The
  screenshot shows how dramatic and *stylistically loud* these are;
  hence Stew's call, adopted here as family law: **fracture cards are
  always rare — 1 copy each, and probably at most one fracture design
  in any deck** (a deck-builder archetype question later, a MOD_CARDS
  discipline now).
- **The invariant to defend**: constraint-outside-freedom-inside. The
  blender in Kid Pix is a slot machine — you click and an effect
  happens *to* you. That exact shape is banned here ("a blur is a brush
  you compose with, not a filter that happens to you"). Every fracture
  card must put the hand back in: the user seeds *which* fragments
  (brush over the regions that may break), *where* they land (drag an
  attractor, paint a destination zone), or *how far* (a per-gesture
  influence). The fragments' cutting can be mechanical; the composition
  may not be.
- **Fragment sources**, in ascending ambition:
  1. **Geometric** — rects/strips of the piece (inherits the lift
     session's machinery directly; the cheapest exemplar).
  2. **Cutout-driven** — rembg finds subjects *in the piece* and the
     fragments are those cutouts (Stew's idea; sidecar via
     `/api/ml/cutout` on a master crop; degrades to geometric).
  3. **Structure-driven** — fragments from the piece's own edges/
     regions (a shatter-adjacent idea; `shatter.js` already exists for
     the stashed transfer card and may be reusable).
- **Sequencing**: build **one exemplar card** (geometric fragments,
  hand-seeded, hand-landed) and play it before designing siblings. The
  family's world of variations is real but it opens *after* the first
  one proves the judgment loop feels like composing, not slotting.
- **Names**: open. *Shatter* is spoken for in code (`shatter.js`);
  register candidates to start from: *Fracture*, *Splinter*, *Riddle*
  (to riddle = to perforate), *Scatter*. Decide at the exemplar's card
  sheet.

---

## 5. Card: Closer

*Deeper's sibling: the same 4:5 frame session, the same re-frame — but
no detail restore. The zoom keeps exactly the pixels it magnifies;
enlargement means visible grain, and that's the point.*

- **The constraint / freedom**: identical to Deeper — choose the new
  framing; End maps it onto the whole canvas.
- **Machinery**: the cheapest card of the batch. `deeper.jsx`'s commit
  already *contains* Closer: the 2d-transform re-frame at master
  resolution is the graceful-degradation path when the sidecar is down
  (`commitDeeper` before `restoreDetail`). Closer is that path made
  deliberate — share the frame session between the two cards (small
  factory or a shared module with a `restore: false` flag) rather than
  copying the file. One wrinkle to decide at build time: Deeper's soft
  path uses `imageSmoothingQuality: 'high'`; Closer *wants* the
  pixelation, so it likely sets `imageSmoothingEnabled = false` above
  some zoom factor so the grain reads as crisp blocks, not mush.
- **Why it earns a slot** (not just "Deeper minus a feature"): with the
  upscale, Deeper hides its cost — the piece stays clean. Closer makes
  the cost *visible*: descending into the piece degrades it, and the
  degradation is texture you compose with. Different card, honest
  material. It also deals when the sidecar's answer shouldn't be a
  lottery — Closer pixelates by design, not by outage.
- **Name**: *Closer* (Stew). Reads well as Deeper's sibling — the pair
  can share a naming key (directional comparatives) even though the
  register elsewhere favors process verbs. Fine to lock early.
- **Deck note**: Deeper is 2 copies today; when Closer enters, the
  combined re-frame density probably shouldn't exceed 3 — likely
  Deeper 2 / Closer 1 or 2/2 with something else thinned. Balance pass
  at build time, in `MOD_CARDS` only.

---

## 6. The deck builder — how the deck scales

The question the Kid Pix exploration forces: the card pool is about to
outgrow the deck. Today pool = deck (every design dealt every session,
`MOD_CARDS` verbatim). At 25+ designs that stops working. Two shapes
were on the table:

1. **The huge deck** — everything shuffles in; codas scale up to match
   so sessions still end on time.
2. **The built deck** — a menu where a session's deck is assembled
   under a size cap, with a set list of **deck archetypes** as starting
   points.

**Decision: the built deck (Stew's lean, adopted).** The huge deck
fails on Deck's own invariants, not just on taste: *set-knowledge is
free* only does its work when the set is small enough to hold in your
head — a 45-card REMAINS view is noise, not knowledge, and the deck
overlay's whole legibility project (v4) collapses. Pacing also lives in
`TUNING` + deck composition; a deck that grows without bound turns the
death-shuffle odds into mush. The cap *is* the constraint, and
constraint is the product.

**Built 2026-07-10 (issue #16, branch `claude/deck-editor-16`), awaiting
Stew's browser verification.** Stew pulled Wave 5 forward — the room
exists *before* the remaining Kid Pix cards bloat the deck, reversing
this section's original "opens only after the pool exceeds the deck"
ordering. What shipped, against the proposal below:

- **The name is the Deck editor** — plainly, on screen. Stew's ruling:
  the register is not a totalizing rule; some things are better named
  legibly than creatively for the sake of UX. Now a standing clause in
  CLAUDE.md §1 (tone). The *case/drawer/tray/press bed* riffs were
  passed over for exactly this reason.
- **Cap 20 · floor 12 · max 3 copies per design**, constants in
  `DeckEditor.jsx` — deliberately NOT in `deck.js` (the reducer never
  learned about the room, per the architecture stance below). The cap
  briefly shipped as 22 (the house deck had crept to 21); Stew held the
  line — "just because 22 cards exist doesn't mean it needs to be that
  size" — and cut the house deck to fit: **Ghost 2→1, Stain 2→1,
  Blur 1→2 = 20 exactly**. Open at the Lift merge (#33): Lift's line
  takes the house deck to 21, so one more cut lands with it or Lift
  enters pool-only. Decide there.
- **Pool = all active `MOD_CARDS` designs** (Stew: current designs
  only — Rack and the transfers stay comment-lines until deliberately
  promoted; when a line is uncommented the pool grows by itself).
- **Starting points: House deck only** — the pool can't yet support
  wash-heavy/graft-heavy/fracture-legal with character. `ARCHETYPES` in
  `DeckEditor.jsx` is the list; each future archetype is one data entry.
- **Persistence: `decks` key in `~/.deck-config.json`** (Stew's pick),
  whole-list replace through `POST /api/decks`; saved decks are
  per-machine like folders are.
- **The seam**: `initialState(deckSpec)` takes `[{ id, copies }]` (null
  = house deck); the spec rides `state.deckSpec` so Restart rebuilds
  the same deck; `resolveSpec` re-derives labels/family from
  `MOD_CARDS` and drops unknown ids, so a stale saved deck degrades
  instead of crashing.

The original proposal, kept for the rationale:

- **A home-screen door.** A button beside the session start — a room
  where the playable deck is assembled. ~~Register name needed (§8): not
  "deck builder" on screen~~ → named the **Deck editor**, see above.
- **A size cap** — the deck is N mod cards (N ≈ today's 20, tunable),
  chosen from the pool. Codas stay 3 and stay out of the builder
  entirely; the arc's pacing knobs remain `TUNING`'s, untouched.
- **Archetypes** — a set list of pre-built decks with character (a
  wash-heavy deck, a graft-heavy deck, a fracture-legal deck, the
  house deck = today's 20). An archetype is a *starting point* you can
  play as-is or adjust under the cap. Family laws live here too — "at
  most one fracture" is an archetype/builder rule, not reducer law.
- **Architecture stance** (held in the build): `deck.js` stays pure and
  doesn't learn about the builder. `buildDeck`
  already just expands a card list — the builder's entire output is
  **a `MOD_CARDS`-shaped array handed to `initialState`**. The menu is
  UI; no deck logic anywhere new.

---

## 7. Waves (proposed sequence, checkpoint map)

Cheapest first, each new engine unlocking the next; every card starts
with its `card_anatomy.md` §9 sheet and ends with Stew's browser
verification before commit.

- **Wave 1 — Closer.** No new machinery; extracts the shared frame
  session from `deeper.jsx`. Proves the pair-card pattern.
- **Wave 2 — the lift brush.** The lift session lands in `brushCore.js`
  (or a sibling module); the truck card ships on it. White hole v1.
- **Wave 3 — the stamp brush.** The stamp session (impressions along a
  path); the card reuses Stamp's pick-and-cutout chain in front of it.
  Built 2026-07-12 as **Reverberate** (issue #14): the stamp session is
  the third built-in consumer in `brushCore.js`; the card entered the
  pool at `copies: 0` (the new-cards rule — adopted via the Deck
  editor, never the starter deck). Verified in the browser and closed.
- **Wave 4 — the fracture exemplar.** One card: geometric fragments,
  hand-seeded, hand-landed, 1 copy. Play it before designing siblings.
- **Wave 5 — the deck builder.** The home-screen room, the cap, the
  archetype list. ~~Opens only after the pool actually exceeds the deck —
  Waves 1–4 are what create that pressure.~~ Pulled forward by Stew and
  built 2026-07-10 (§6) so the deck can't bloat while new card variants
  are tested; awaiting browser verification.

Parallel as ever: the inherited backlog (§0, now under `archive/`) and the
`app_plan.md` infrastructure waves run on their own clocks.

---

## 8. Open questions for Stew (answer before each wave opens)

1. **Names → ids** (Waves 1–4): pick from each candidate list (§2
   Straw/Reverberate/Strew/Sow; §3 Trucker/Leaf/Displacer/Lift/Haul;
   §4 at exemplar time; §5 Closer looks settled). The id is cut from
   the chosen name at creation and then never drifts.
   **§2 answered 2026-07-12: Reverberate** (id `reverberate`).
2. **Stamp source** (Wave 3): confirm the outward-facing version (grid
   pick + cutout, like Stamp) — the piece-as-stamp version is parked in
   the fracture family, yes?
   **Answered 2026-07-12: outward-facing confirmed** — the
   piece-as-stamp version stays parked with the fracture family.
3. **Closer's copies** (Wave 1): Deeper 2 / Closer 1? 2/2 with a thin
   elsewhere? And should Closer pixelate crisply (smoothing off past
   some zoom) or stay soft?
4. **The fracture judgment loop** (Wave 4): of the three hand-backs —
   seed the fragments, place the landings, per-gesture influence —
   which one(s) make the exemplar? (At least one is mandatory; the
   slot-machine shape is banned.)
5. **The builder's register name** (Wave 5): what is the room called?
   **Answered 2026-07-10: the Deck editor** — legibility over register
   for utility surfaces; the ruling is now the legibility clause in
   CLAUDE.md §1.
6. **The cap** (Wave 5): is N = 20 right, and may a built deck go
   *under* the cap (a lean 12-card deck as a legal, faster session)?
   **Answered 2026-07-10: cap 20, floor 12** — a lean deck is a
   legal, faster session; the floor keeps the death-shuffle honest
   (acts consume 6 cards). The house deck was thinned the same day to
   fit the cap exactly (Ghost 2→1, Stain 2→1, Blur 1→2; §6). The one
   remainder: at the Lift merge the house deck hits 21 again — one
   more cut or Lift goes pool-only, decided there.
