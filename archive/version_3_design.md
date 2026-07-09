# Deck v3 — The card system design

> Working document, started 2026-07-03. Nothing in here is locked yet.
> v2 built the machinery (master raster, brush core, grid picker, ML sidecar,
> ten working cards). v3 is about turning that patchwork of cards into a
> **coherent, balanced, flavored system** — what the cards are, how they feel
> as a set, and what the arc of a full session becomes.
>
> Notation used throughout:
> - **[Stew]** — direction from Stew's notes (2026-07-03 brain dump)
> - **[proposal]** — Claude's iteration on that direction, up for debate
> - **[open]** — a genuine open question, collected again in §10

---

## 1. What v3 is

v2 answered *"can each card work?"* — every mechanic in the target set is
built and playable. What playtesting exposed is that the deck is a
**collection**, not a **system**:

- Cards were designed one at a time, so they don't rhyme with each other.
- Half the names are custom and evocative (Ghost, Rails, Deeper, Coda), half
  are settings-menu labels (HSV Brush, Color Overlay, Blur Brush).
- The opening ritual (two dice rolls) is more ceremony than the choice it
  gates deserves.
- Some standing tools (erase) are one notch less capable than the real
  collage gestures they stand in for (masking, softening, repositioning).

v3's scope is therefore three braided threads plus the supporting tooling:

1. **Card anatomy** — a shared internal structure (mechanic × suit) so new
   cards are generated from a system rather than invented from scratch (§3).
2. **The naming language** — one flavor register for every card name, in the
   spirit of *zyme*: metabolic, fermentative, decompositional, poetic but not
   clinical, and never new-age (§4).
3. **The session arc** — a simplified opening, and new *shapes of play* in
   the middle: depth, enclosure, echo (§5, §7).
4. **Standing-tool upgrades** that the card system leans on: the mask brush
   and the soften brush (§6).

The card design rule from v1/v2 survives untouched: **constraint outside,
freedom inside.** And the tone invariant survives: this is a studio
instrument, not a game.

---

## 2. What playtesting v2 taught

Straight from the sessions **[Stew]**:

- **The overall quantity of moves feels right.** Not too few actions, not too
  many, to make an image. Don't disturb the act structure lightly.
- **Place/stash is a keeper.** Getting to modify the base before a second
  wave of image material arrives is doing real compositional work.
- **In practice you only ever take two images** — one placed, one stashed.
  Partly debugging haste, but also structural: Ghost, Stamp, and Rails all
  *add image information mid-session*, so the opening doesn't need to carry
  the whole material budget. More cards in that family will only strengthen
  this.
- **The opening dice rolls feel clunky.** The reveal is ceremony around a
  choice that has collapsed to "take two." Candidate for removal.
- **Cards have layers of anatomy.** Ghost is really two decisions stacked:
  *add an image* (the mechanic) and *screen blend* (the treatment). Rails is
  *alpha-stencil cutout* (the mechanic) and *solid color fill* (the
  treatment). These layers can be recombined — that's the seed of §3.
- **Deeper stands alone** — it's the only card with a *direction*. It forces
  an ongoing journey inward: earlier detail becomes blotches of color, new
  work layers onto the zoomed base, and ESRGAN's texturization (especially
  on noise) rewards the dive. The deck should have more cards with a
  direction, and possibly an opposing one (§7).
- **Blur wants to be a standing tool, not just a card.** Softening the
  boundary between images is a constant real-collage gesture, like erasing —
  it homogenizes the outcome (§6).
- **Erase wants to grow into a mask brush.** The recurring gesture is:
  scale a layer to fit → soft-mask its edges → *reposition it* → correct the
  mask for the new spot. Pure erase can't take anything back, so it punishes
  the reposition step (§6).
- **No drawing, ever.** All production is reductive/recombinant: placing,
  masking, resampling, re-framing, revealing effects through masks. This is
  a thematic invariant, and §4's language should reinforce it.

---

## 3. Card anatomy: mechanic × suit

**[Stew]** The insight: a card like Ghost is a *mechanic* (bring on a new
image from a grid pick) wearing a *treatment* (screen blend). The treatment
is where the thematic flavor lives — like basic land types in Magic, the
blend mode is the card's terrain. If the mechanics are solid, one mechanic
can be issued in several suits, and the deck grows combinatorially without
any card feeling arbitrary.

### 3.1 The mechanics (all already built in v2)

These are the proven chassis. Each is a shared module, not a one-off:

| Mechanic | What it is | v2 modules | v2 cards on it |
|---|---|---|---|
| **Graft** | Grid pick → new image placed with arrange + mask brush | `CardGridPicker`, `placement.js`, `brushCore` | Ghost, Stamp |
| **Stencil** | An image read as an alpha cutout of itself, filled with something, stamped on | `shatter.js` | Rails, (Shattered Transfer) |
| **Reveal brush** | Full-strength effected copy of the master, fully masked; painting reveals it | `createRevealSession`, `effectCardFactory` | Noise, Blur, HSV brushes |
| **Wash** | Whole-canvas treatment behind an influence slider (color adjustments only — the standing exception) | overlay + influence pattern | Color Overlay, Global HSV |
| **Re-frame** | The master itself becomes the object: crop, zoom, rotate, flip | `masterRaster`, ESRGAN restore | Deeper, Reposition |

A sixth chassis exists but is parked: **Transfer** (styled redraw of the
master) awaits Stew's own trained style models.

### 3.2 The suits (blend modes as terrain)

**[Stew]** The approved palette — modes that suit the work's temperament, no
hard-mix/color-burn drama:

> multiply · soft light · darken · lighten · screen · difference · exclusion

**[proposal]** Treat these as roughly **four suits**, because several modes
are siblings in feel:

| Suit | Modes | Temperament |
|---|---|---|
| **Sink** | multiply, darken | The addition soaks *into* what's beneath; stains, deepens, weights |
| **Rise** | screen, lighten | The addition floats *over*; ghosts, breathes, pales |
| **Cure** | soft light | Gentle, tonal; deepens without dominating |
| **Bruise** | difference, exclusion | Chemical inversion; discolors where things touch |

Suits are a **design vocabulary, not UI**. A card doesn't announce "this is
a Sink card" — per the tone invariant, no genre signaling. The suit shows up
as family resemblance: in the name's register, in the treatment's behavior,
maybe eventually as a quiet mark on the card face. **[open §10.1]** whether
suits ever surface visually at all.

### 3.3 The generative rule

A v3 card = **one mechanic + one suit + one deliberate alteration**, given a
proper name. Examples of what the matrix yields immediately:

- **Graft × Rise** = Ghost (exists — screen blend, opacity, B/C, mask).
- **Graft × Sink** = Ghost's dark sibling: an image placed in multiply that
  stains *through* the canvas instead of floating over it. New card, nearly
  free to build. (Naming candidates in §4.)
- **Graft × Bruise** = an image placed in difference/exclusion — spectral
  discoloration where it overlaps. Wilder; maybe one copy only.
- **Stencil × Sink** = Rails' cutout shape, but instead of a solid color it
  darkens/multiplies what's beneath — linework as shadow rather than paint.
- **Stencil × canvas-self** = the cutout filled with the canvas's *own*
  pixels, offset or transformed — the piece printing through a mask of a
  stranger image. (This one is an alteration-heavy variant; prototype first.)
- **Wash × Cure** = a soft-light self-overlay with influence — the classic
  "richen the mids" darkroom move, distinct from Color Overlay and HSV.

**The matrix is a quarry, not a factory.** Not every cell should exist —
curate for cards that earn a name. But when the deck needs a new card, the
first question is now "which cell?" instead of "what feature?" This directly
serves the locked v2 goal: *grow the library until sequences feel unique
each session.*

**[proposal]** Rebalancing principle that falls out of this: think of deck
composition as suit ratios, not card counts. A session that deals three Sink
cards in a row has a *mood*; the shuffle produces weather. That's a feature —
but copy counts should keep any suit from dominating (§8, §9).

---

## 4. The naming language — the zyme register

**[Stew]** Custom names (Ghost, Rails) beat descriptive labels (HSV Brush,
Color Overlay). The whole deck should read like a named set — tarot-*like* in
coherence but explicitly **not** tarot in flavor (no new-age, no mysticism).
The register: *zyme* — metabolic, fermentative, decomposition — with poetry,
but not too biological/technical.

### 4.1 Principles

1. **One word, concrete, physical.** Verbs and process-nouns from
   fermentation, curing, decomposition, and the darkroom/press. Things that
   happen to material over time.
2. **The name describes the gesture, not the algorithm.** "Silt" not "Noise
   Brush." The settings-menu register is banned from card faces.
3. **Reductive language only.** Nothing that implies drawing or authorship
   of marks — everything is steeping, settling, turning, leaching,
   revealing. This enforces the "no drawing" invariant at the vocabulary
   level.
4. **No game words, no spirit words.** (Existing tone invariant + the
   no-tarot rule.)

### 4.2 The vocabulary bank

A quarry to draw from as the library grows — names are cheap to bank, cards
are not:

> **process**: steep, cure, brine, leaven, proof, bloom, macerate, render,
> reduce, rack, turn, leach, scald, char, smoke, salt, settle, cleave
> **matter**: silt, lees, must, culture, mother, spore, marrow, pith, rind,
> tannin, sediment, patina, verdigris, rust, ash, grist
> **state/decay**: bruise, tarnish, wane, sour, mellow, slack, bloom (mold
> sense), weather, erode
> **press/darkroom adjacent**: mount, plate, fix, burn, dodge, contact,
> tissue, register

### 4.3 Proposed renames of the existing set **[proposal — all debatable]**

| Today | Proposed | Why |
|---|---|---|
| Ghost | **Ghost** (keep) | Already right: Graft × Rise, named for its behavior |
| Stamp | **Stamp** (keep) | Press language; already right |
| Rails | **Rails** (keep) | Already custom; earns its name |
| Deeper | **Deeper** (keep) | The one card with a direction; the name *is* the direction |
| Coda | **Coda** (keep) | Locked in v2 Phase 1 |
| Noise Brush | **Silt** | Fine particulate settling onto the surface — and ESRGAN literally texturizes it into sediment when Deeper follows |
| HSV Brush | **Bruise** | Localized discoloration is exactly what a bruise is; painting hue-shift *is* bruising the image |
| Global HSV | **Turn** | The whole batch turns — milk turns, weather turns, the piece turns |
| Color Overlay | **Steep** | The canvas soaked in a dye bath; the influence slider is steeping time |
| Reposition | **Rack** | Racking: moving the material to a new vessel without changing it — flips, rotation, zoom |
| Blur Brush | **Dissolve** — *if it survives as a card at all* (§6.3) | Edges giving up their boundary |

Names banked for the near-term matrix cards (§3.3): **Stain** or **Sink**
(Graft × multiply), **Scald** or **Sour** (Graft × difference), **Char**
(Stencil × darken), **Cure** (Wash × soft light), **Pore** (§7.3), **Mount**
(§7.4).

**[open §10.2]** Whether "stash" itself gets a register name in the UI —
e.g. the held image is **the reserve** or **the mother** (the culture you
hold back to start the next stage). Possibly too cute; "stash" may be fine.

---

## 5. The opening, simplified

**[Stew]** The two dice rolls are clunky ceremony around a choice that has
collapsed in practice to "take two." Proposed replacement:

> **A fixed 5×5 grid of 25 images. Take two: one to place now, one to
> stash.** No rolls, no variable counts.

**[proposal]** Endorse, with reasoning made explicit:

- The *meaningful* choice in the opening was never "how many" — it's
  **which**. A 25-image grid nearly doubles the v2 maximum (16), so the
  choice gets *richer* while the ceremony gets shorter.
- Fixing the counts makes the stash return a **constant beat**: exactly one
  image, always, arriving after Act I. Pacing becomes predictable in the
  right way — the *content* is the variable, not the structure.
- Material budget stays healthy because Graft-family cards (Ghost, Stamp,
  the §3.3 siblings) carry image-addition through the whole session. The
  opening is a seed, not the pantry.
- Removing `OPENING_ROLLS` simplifies `deck.js` and retires the dice-tumble
  reveal in `GridPicker` — less code, and the manual-physical-dice
  provision quietly retires with it.

Consequences to accept knowingly:

- **The stash is now mandatory and exactly one.** v2 allowed stash-nothing
  (skip the return) and stash-several. If a session wants to start from a
  single image, that door closes. **[open §10.3]** — alternative: "take
  two: place at least one" keeps a stash-zero escape hatch at slight cost to
  the constant-beat property.
- **The dice grammar leaves the opening entirely.** If dice-styled reveals
  are worth keeping anywhere, it's in the deal or in future card mechanics,
  not here. **[open §10.4]**

The grid itself: 25 samples via the existing `/api/images/sample?n=25`, same
place/stash cycling UI as today minus the roll phase. Small build.

---

## 6. Standing tools: from erase to mask, plus soften

Erase was v2's one standing tool ("erase is a standing tool, not a card").
v3 grows the standing kit to match the real collage gestures — these are
infrastructure, available in every placement session (opening, stash
return, Ghost, Stamp, Rails, and all future Graft/Stencil cards).

### 6.1 The mask brush (erase grows up)

**[Stew]** The real working loop is: scale the layer to fit → soft-mask the
edges → *try it somewhere else* → correct the mask for the new position.
Pure erase punishes step three: what's erased is gone, so repositioning
means living with a mask shaped for the old spot.

**[proposal]** Upgrade the standing erase to a **mask brush**: two modes,
*conceal* and *restore* (paint out / paint back), on the same brush
controls (size, hardness, strength). Architecture note: this is close to
free. `brushCore` already keeps a per-image native-resolution mask and
**never touches source pixels** — restore is just painting white back into
that mask. And because the mask lives in image-native coordinates, it
already travels with the image through move/scale/rotate — the
reposition-then-correct loop works today by construction; what's missing is
only the restore mode and its toggle.

Language: not "erase/unerase." Conceal/restore, or in-register:
**leach / fix**. **[open §10.5]** the exact labels.

### 6.2 The soften brush (blur as a standing tool)

**[Stew]** Blur/smudge is a constant gesture for homogenizing boundaries
between images — it wants to be present across the work, like erase.

**[proposal]** The honest, cheap version first: **soften = blurring the
mask, not the pixels.** A standing brush mode that locally feathers the
placed layer's mask edge. This *is* the collage gesture ("soften the
boundary between images") without any cross-layer pixel machinery — the
soft transition emerges from the composite. Implementation is a small
blur-kernel dab into the existing mask layer.

The stronger version — true pixel smudging across the baked canvas —
remains a card (Dissolve) or a later upgrade. Don't build it as standing
infrastructure until the mask-feather version proves insufficient.

### 6.3 Does the Blur card survive?

With soften standing everywhere, a dedicated blur *card* must justify
itself. Options:

- **(a) Retire it.** Boundary-softening was its real job; done.
- **(b) Keep as Dissolve, redefined**: whole-canvas reveal-brush blur (the
  v2 mechanic) is genuinely different — it blurs *interior content* on the
  baked master, not layer edges. One copy, positioned as a texture-eraser
  (and a strong Deeper companion: dissolve then dive).
- **(c) Fold into a suit variant later.**

**[proposal]** (b) — keep one copy, watch it in playtests, retire it in
tuning if it never earns its round. **[open §10.6]**

---

## 7. Shapes of play — the sequence itself

The act structure survives (**[Stew]**: quantity feels good): opening →
placement → Act I (~4) → stash return → Act II (~2) → Coda shuffled in →
end. What v3 adds is **shape** inside that arc.

### 7.1 The axis of depth

**[Stew]** Deeper is the only card with a *direction* — an ongoing journey
inward. Earlier detail abstracts into blotches of color; new work layers
onto the zoomed base; ESRGAN's texturization (spectacularly on noise)
rewards each dive. It could go on forever. This inward/outward axis is one
of the most interesting things in the system.

**[proposal]** Name the axis explicitly in design terms: some cards move
**along** the depth axis (Deeper inward, Mount outward — §7.4), some cards
**deposit material** that the axis will later transform (Silt is the
canonical deposit: grain now, sediment-texture after the next dive). Deck
composition should keep at least one axis card and a couple of deposit
cards in most sessions — that's what makes runs feel like journeys instead
of playlists.

Synergies stay **loose, never scripted**: Silt→Deeper is a discovered
compatibility, not a combo the system enforces. (**[Stew]**: "or not, since
I don't want the outcomes to look the same constantly.") The deck creates
the *odds* of a synergy, the shuffle decides.

### 7.2 Enclosure — working inside a pore

**[Stew]** A card that constrains the viewport to a small percentage of the
canvas — a zoom *without* clipping. You're required to focus on an area
without perceiving the whole, apply modifications there for a stretch, then
return to full scale.

**[proposal]** Card sketch — **Pore**:

1. Drawn like any card. You place a small frame (fixed aspect, corner-scale
   — the Deeper frame interaction, reused) anywhere on the canvas.
2. The view *enters* the frame: the working canvas shows only that region.
   No pixels are cropped; this is a viewport constraint, not a re-frame.
3. **The next N cards are dealt and worked entirely inside the pore**
   (N = 2 feels right; tune later). Their effects apply only within it —
   which the master raster makes natural: bake the pore region back into
   the master each End.
4. After the Nth End, the view recedes to full scale and you see what the
   enclosure did to the whole.

This introduces a genuinely new deck concept: a card whose effect **spans
the following rounds** — a *duration card*. `deck.js` would carry a small
`enclosure: { region, roundsLeft }` field; the reducer decrements it per
COMMIT. Still a pure reducer; Editor applies the viewport.

**The Deeper collision is a feature.** **[Stew]** flagged it: if you grow
attached to the pore region and Deeper (or the Coda) arrives after release,
you may be forced to frame *away* from the area you invested in — or if
Deeper lands *inside* an enclosure, the natural rule is that its frame is
confined to the pore. Both are commitment doing its job. Proposed rule:
**cards dealt inside a pore obey the pore**, Deeper included — you enclosed
it; now the dive happens there.

### 7.3 Echo — doubled cards as deliberate rhyme

**[proposal]** Cheap shape, no new tech: copy counts already allow the same
card twice in a session, but the shuffle scatters them. A variant worth
trying in tuning: when a card's *second* copy is dealt, it arrives with one
parameter deliberately inverted or extremified (Ghost's second copy deals
darker; Silt's second copy is coarse where the first was fine). "Variants
share a chain with one deliberate alteration" — applied *within* a session.
Park for Phase-tuning; costs one field in the card descriptor.

### 7.4 Outward — the counterpart to Deeper **[proposal, speculative]**

If Deeper dives, something could surface. Sketch — **Mount**: the current
piece scales *down* onto a larger ground (the master becomes an object at,
say, 60–80% on a new full-size canvas) and you place it — position, angle —
like a print being mounted. The revealed margin is the constraint's
question: it could be filled by a stretched/mirrored bleed of the piece's
own edges, a flat color from the piece's palette, or a Graft-style pick.
The margin *will* be worked by subsequent cards either way.

This is the least-proven idea in the document — it needs a prototype to
know if the margins read as intentional or as letterboxing. Hold it until
the core v3 set lands. **[open §10.7]**

### 7.5 Shapes considered and set aside (for the record)

- **Drafting the deal** (deal two, keep one): adds judgment at the deal but
  softens the deck's authority — half the point of a card is that you don't
  choose it. Against the commitment philosophy. Shelved.
- **Scripted combos** (card A guarantees card B next): kills the shuffle's
  weather. Synergies stay probabilistic (§7.1).

---

## 8. The target v3 deck (first draft)

Existing cards renamed per §4.3, plus the near-term matrix cards and Pore.
One array literal in `deck.js`, as ever:

| Card | Mechanic × suit | Copies | Notes |
|---|---|---|---|
| **Ghost** | Graft × Rise | 2 | unchanged |
| **Stain** *(new)* | Graft × Sink | 2 | Ghost's multiply sibling — near-free build |
| **Stamp** | Graft (cutout) | 2 | unchanged |
| **Rails** | Stencil × solid | 1 | unchanged |
| **Char** *(new)* | Stencil × Sink | 1 | Rails' shadow sibling — cutout darkens instead of paints |
| **Deeper** | Re-frame (inward) | 2 | unchanged |
| **Rack** | Re-frame (neutral) | 1 | = Reposition renamed |
| **Silt** | Reveal × deposit | 2 | = Noise renamed; up from 1 for the Deeper synergy odds |
| **Bruise** | Reveal × Bruise | 1 | = HSV brush renamed |
| **Dissolve** | Reveal × blur | 1 | provisional — §6.3 |
| **Steep** | Wash × Sink | 1 | = Color Overlay renamed |
| **Turn** | Wash (hue) | 1 | = Global HSV renamed |
| **Cure** *(new)* | Wash × Cure | 1 | soft-light self-overlay + influence |
| **Pore** *(new)* | Enclosure (duration) | 1 | §7.2 — the one structural card |
| **Coda** | death | 3 | shuffled in after Act II, unchanged |

**19 mod cards** (up from 13), of which ~7–9 are seen per session (4 + 2 +
however long the Coda hides). Sessions overlap less than v2's — closer to
the *unique-sequence* goal — while every new card is either a suit-sibling
of a proven chassis or the one new structural mechanic (Pore).

Deliberately **not** in this draft: Mount (§7.4, needs prototype), Graft ×
Bruise (wild; add once Stain proves the sibling pattern), Transfer twins
(await trained styles — they'll slot back in as their own suit family).

---

## 9. Balance — how we'll know it's right

Working ratios to evaluate playtests against (not hard rules):

- **Material vs. transformation vs. structure.** Cards that *add image
  information* (Graft + Stencil families: 8 of 19 above) vs. cards that
  *transform what's there* (Reveal + Wash: 7) vs. cards that *change the
  frame or the rules* (Re-frame + Pore: 4). Roughly 40/35/25. If sessions
  feel crowded, the material share drops first — the opening + stash
  already guarantee two placements per session.
- **Suit weather.** No suit should exceed ~⅓ of the deck, so a session can
  lean dark or pale but not monochrome by default.
- **Axis presence.** ≥2 depth-axis cards (Deeper ×2) so most sessions offer
  at least one dive; deposit cards (Silt ×2) at similar odds.
- **Per-session uniqueness.** The real test **[Stew's stated goal]**: do two
  consecutive sessions feel like different journeys? When they stop feeling
  distinct, the answer is more matrix cells, not more copies.

Playtest questions to answer per session (tuning-phase checklist):

1. Did any card feel like it "just did something"? (instant fail — rework)
2. Did the opening choice feel rich at 25 / take-two?
3. Did the stash return land as an event?
4. Did a synergy *happen* (unscripted)? Did it feel discovered or repetitive?
5. Was the Coda's arrival a finish or an interruption?

---

## 10. Open questions (for the next session with Stew)

1. **Suits visible or backstage?** (§3.2) — quiet mark on the card face vs.
   pure design vocabulary.
2. **Register name for the stash?** (§4.4) — "reserve" / "mother" / keep
   "stash".
3. **Opening: strict place-one-stash-one, or "take two, place at least
   one"?** (§5)
4. **Do dice leave the product entirely,** or does the deal keep a small
   reveal moment? (§5)
5. **Mask brush mode labels** (§6.1) — conceal/restore vs. leach/fix vs.
   plainer words.
6. **Dissolve: keep one copy or retire?** (§6.3)
7. **Mount: prototype after core v3, or drop?** (§7.4)
8. **Pore duration** — N=2 rounds? And confirm the "cards inside a pore obey
   the pore" rule, Deeper included. (§7.2)
9. **Rename rollout** — all at once, or as each card is next touched?

---

## 11. Build-order sketch (rough — a real phase plan follows doc lock)

Ordered so each step is playable and the risky/new mechanics go early-ish,
per the v2 method:

1. **Opening rework** — 5×5 fixed grid, take two; delete the roll phase.
   Small, immediately felt every session.
2. **Mask brush + soften** — restore mode and mask-feather dab in
   `brushCore`; every placement session improves at once.
3. **The renames** — one pass over labels/copy (cheap; do early so
   playtests happen in the real language).
4. **Suit siblings** — Stain, Char, Cure: three new cards, each mostly
   configuration of an existing chassis. Proves the matrix.
5. **Pore** — the duration-card mechanic in `deck.js` + the viewport
   constraint. The one genuinely new structure.
6. **Tuning** — deck ratios (§9), Echo experiment (§7.3), Dissolve verdict,
   Mount decision, death-crop decision (still parked from v2 §0.2).

---

*Companion documents: `design_changes_july2.md` (v2's why),
`redesign_v2_plan.md` (v2's how). This document supersedes neither — it
builds on the machinery they produced.*
