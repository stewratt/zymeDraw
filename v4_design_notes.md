# v4 design notes — randomness, control, and the legible deck

> Companion to `v4_design.md`. That doc specified the deck overlay (spent /
> remains); this one is the design analysis it provoked: **now that the deck
> is legible, how much should it tell you — and where are the missed
> opportunities in the sequence itself?** Written 2026-07-05, thinking out
> loud with Stew. Nothing here is committed to build; §7 is the
> recommendation.

---

## 1. The direct question: why not show the exact order?

Stew's framing: the shuffle already happened, the randomness is already
"spent" — so what's actually lost by showing the whole sequence?

What's lost is not randomness. It's **three specific experiences** that only
exist while order is hidden:

**1. The deal is the heartbeat.** Each deal is currently a *reveal* — a small
event with genuine information in it. The card-flip animation, the two-press
rhythm (End, then Deal — the auto-deal experiment failed precisely because it
erased this beat), the pause where you wonder. With a visible queue, the deal
becomes ceremony without content. You'd be pressing a button to advance a
schedule you've already read. The tool's pulse flatlines.

**2. Response becomes scheduling.** With hidden order you *respond*: the card
arrives, you look at the canvas as it is now, and you find what this card can
do *here*. With visible order you *plan*: on round one you'd mentally
simulate the whole session, assign intentions to every future round, then
spend the rest of the session executing your own checklist. The creative
attention moves off the canvas and onto the schedule. Improvisation — the
thing that produces outcomes you couldn't have planned, which is the tool's
entire value proposition — gets optimized away. Constraint you didn't choose
is the engine; a visible queue lets you choose your way around all of it in
advance.

**3. Every round gets pre-discounted.** This is the killer, and it's
Stew's splash-over tension *inverted and made worse*. Today you under-invest
because an unknown card *might* splash over your work. With a visible queue
you'd under-invest with certainty: "Silt is two rounds away, so this round is
just setup." Known futures drain present rounds of their weight. And if the
Coda's position is visible, the session gains a countdown timer — the last
known rounds become "wrap-up" work, and a piece that knows when it will die
composes itself defensively. Even hiding only the Coda while ordering the
mods still lets you schedule around everything else.

The steelman for full visibility: some artists genuinely prefer a fixed
program — a workshop with a printed schedule. That's a legitimate way to
work; it just isn't *this* tool. Deck's identity is the darkroom session
where the chemicals have opinions. (If the urge persists, the right home for
it is a separate practice mode — see §6.4 — not the session.)

**The distinction that resolves it:** *set-knowledge* vs *order-knowledge*.
Knowing WHAT remains enables planning-toward ("a Deeper is still out there —
I'll compose with a crop in mind") without enabling scheduling. Knowing WHEN
kills response. The v4 overlay landed exactly on this line — the same line
roguelike deck-builders converged on after a decade of iteration (you always
know your deck's contents, never its order). That convergence isn't fashion;
it's the stable equilibrium between agency and surprise.

---

## 2. The design principle that falls out

> **Set-knowledge is free. Order-knowledge and order-control are resources —
> earned, dealt, or spent, never ambient.**

The overlay gives away what's cheap (the multiset) and holds what's precious
(the sequence). Everything in §5 is a way of *selling* small amounts of the
precious thing back to the player at a price: a card slot, a once-per-session
right, a gamble. This is how you deepen control without draining surprise —
the player who wants more certainty must *do something* to get it, and the
doing is itself a decision with weight.

A second principle, for where control should live:

> **Control at the boundaries, chance in the moment.**

Give the player strong levers *between* rounds and *before* the session
(what's in the deck, what to hold back, when to call the stash) and keep the
moment of the deal pure. The opening already works this way — you choose two
images with total freedom, then the deck takes over.

---

## 3. The splash-over tension, examined

*"Why would I spend a lot of time really intentionally working on this layer
when the next thing in the sequence will just splash all over it?"*

First, name what this actually is: **loss aversion pointed at the future.**
The next card is experienced as a threat to sunk effort. Three honest
responses, in increasing order of interest:

**3a. It's already mostly false — mechanically.** Every card in the current
set carries an influence slider, an opacity control, or the standing mask
brush. Nothing "splashes all over" your work unless you let it; the erase
brush is a full veto over any graft, the influence slider is a full veto over
any wash. The only genuine destroyer is Deeper (the crop eats the outside)
— and that destruction is its identity. So the tension is *perceived*, not
mechanical. But perceived tension is still real tension, and telling the
player "actually you're wrong to feel that" is not design.

**3b. The v4 overlay is already the strongest medicine.** The fear thrives on
vagueness — "*something* is coming." The remains view converts vague dread
into a specific, plannable field: if the remains are all washes and brushes,
invest heavily, nothing coming can eat structure; if a Deeper is still out
there, keep your composition crop-tolerant. This is exactly the "creative
decisions around what's left" insight that motivated v4. Expect this tension
to soften on its own now that the deck is legible. Worth playtesting before
adding anything else for it.

**3c. The record answers what protection can't.** The deep version of the
fear isn't "my work will be covered" — in collage, *everything* gets covered;
that's the medium. It's "my work will be covered *and no one will ever know
it was there*." The mechanical answer to that isn't protection (see §6.1 for
why protection mechanics fight the philosophy) — it's **preservation of the
record**. Which suggests the Proof Sheet (§5.6): every round's state is
already captured at bake time in spirit; keep a small snapshot each round and
offer the sequence itself as a session artifact at the end. Your buried
layers stay buried in the export — but they exist in the proof, the way
underpainting exists in an X-ray. Effort is never erased, only stratified.
This reframes every round's work from "temporary" to "geological."

And one reframe worth saying out loud: **the tension is also the discipline.**
The tool teaches the printmaker's posture — nothing precious, everything
provisional until the Coda. A player who never feels that tension is not
being changed by the tool. The goal isn't to eliminate the feeling; it's to
keep it at the level of *productive looseness* rather than *why bother*.
3a–3c manage the level; they shouldn't erase it.

---

## 4. Missed opportunities — a map of the sequence

Walking the session arc beat by beat, asking "where does the player have no
decision, and should they?":

| Beat | Today | Missed opportunity |
|---|---|---|
| Pre-session | The deck is fixed by `MOD_CARDS`. | The player never touches deck *composition* — the biggest control lever that costs zero in-session surprise (§5.4). |
| The opening | Strong: free pick of two from 24. | Fine as is. The one free-choice beat; don't dilute it. |
| The deal | Pure chance, pure reveal. | Correct — protect it. All control should be sold *around* it, never into it (§2). |
| Within a round | Strong: the card's whole freedom-inside-constraint design. | Fine. |
| Between rounds (End → Deal) | A pause; the overlay now lives here. | The natural home for spendable rights: pass/bury, peek, recall (§5.2, §5.3, §5.5). |
| Stash return | A fixed beat after Act I. | The player controls nothing about it — timing is a decision begging to be given away (§5.5). |
| Act II → death | The Coda arms; odds rise as the deck thins. | Good slow burn. Legibility of "armed" already exists. Leave it. |
| The Coda | Instant end. | The parked death-crop; plus the session's record is discarded (§5.6, §6.5). |

The pattern: the arc's *middles* are strong and its *boundaries* are
underused. Every candidate below lives at a boundary.

---

## 5. Candidate mechanics

Each with: what it does, what it costs the design, tone-register name
candidates, implementation weight against the current architecture, and a
verdict. Ordered roughly by conviction.

### 5.1 The tutor — pick your next card *(Stew's idea — build it)*

**What:** A card that, when dealt, opens the remains (the exact grid the
overlay already renders) and lets you take any remaining mod — that card
becomes this round. The Coda is not in the view and not pickable, per the
visibility rule.

**Why it works:** It's the visibility mechanic *cashed in*. The overlay
turns from information into an instrument the moment this card is dealt —
you've been planning toward "what remains" all session, and now you get one
moment where planning becomes choice. It also self-balances: dealt early,
the choice is wide but so is your uncertainty about what the piece needs;
dealt late, the remains are thin but you know exactly what the piece is
missing. Same card, different texture every time — a *named, opinionated
chain* by the v2 definition.

**Costs:** One round of pure chance is lost per copy. At 1 copy in ~19,
negligible — and the deal of the tutor itself is still a chance event.

**Edge:** remains empty when dealt (deck exhausted to deaths) → the card
shows the empty remains and End is enabled immediately — a round where the
deck had nothing left to offer. Rare, melancholy, fine.

**Name (zyme register, one process word):** **Cull** (choosing by taking
from the group — precise), **Sift** (sorting through to find; maybe too
close to Silt on the tongue), **Dredge** (dragging something up from the
deck's depths). Lean **Cull**.

**Weight:** Light. One reducer action (`PICK_FROM_DECK`: remove chosen card
from `state.deck`, set as `currentCard` — pure, ~10 lines), one card file
whose `begin` awaits the user (the Ghost pattern), reusing the overlay's
remains grid as its Overlay component. The v4 work already built 90% of it.

### 5.2 Skim — look at the top, keep or bury *(build it)*

**What:** A card (or possibly a standing once-per-act right — start as a
card) that reveals the top card of the deck, then offers one choice: leave
it (it's your next deal) or bury it (bottom of the deck / random reinsert),
never seeing what replaces it.

**Why it works:** This is the *smallest possible unit* of order-knowledge
and order-control, sold together. It converts one future deal from unknown
to known — the Tetris-preview effect: short-horizon planning, long-horizon
mystery intact. The keep-or-bury choice is genuinely hard: bury the Deeper
you're not ready for, and you've drawn *something* — maybe worse. And it
plays against the Coda beautifully once death is armed: skimming into a Coda
and burying it is a reprieve you'll feel in your chest; skimming into it and
*keeping* it is choosing your ending — the most commitment-flavored decision
the tool could offer.

**Question to resolve:** can Skim see a death card at all, or does it skim
only the top *mod*? Seeing it is the sharper design (the reprieve/acceptance
moment above); hiding it is more consistent with "Coda timing is never
revealed." Recommend: **Skim sees everything** — it's a paid, dealt, one-card
exception to the rule, which is exactly what §2 says exceptions should be.
(Note: bury-the-Coda softens death pacing slightly; at 1 copy it's within
tuning noise, and TUNING owns the knobs if not.)

**Costs:** Slightly bends "death timing stays secret." As a 1-copy card,
the bend is an event, not a policy.

**Name:** **Skim** (off the top — print and darkroom both skim). Alt:
**Riffle** (see 5.7 for the bigger version).

**Weight:** Light. Reducer: `SKIM` (reveal top) + `BURY`/`KEEP` actions,
all pure list operations. UI: a single-card reveal panel, reusing `<Card>`.

### 5.3 The pass — one refusal per session *(playtest after 5.1/5.2)*

**What:** A standing right, not a card: once per session, at the moment a
card is revealed, you may set it aside — it leaves the session entirely —
and deal again. Death cards cannot be passed (or: passing is only possible
before death is armed; decide in tuning).

**Why it works:** It's the pressure valve for the exact "forced to commit to
a thing because it is happening" moment — but *scarce*, so it doesn't
dissolve the commitment ethos; it concentrates it. All session you carry the
question "is this the card I refuse?" and every card you *don't* pass on,
you chose to accept. Refusal-as-resource makes acceptance meaningful. (This
is the mulligan/burn mechanic that nearly every dealt-card game eventually
grows, because forced deals occasionally whiff and one bounded veto costs
almost no surprise.)

**Costs:** The strongest philosophical tension of anything here — Deck's
identity is "the card happens to you." One bounded exception per session is
spice, not policy, but this one deserves a playtest verdict rather than an
argument. Ship 5.1/5.2 first; if the "forced commitment" complaint survives
them, add the pass.

**Name/UI:** a quiet `set aside` link on the revealed card, present only
while unused. Not a button that looks like a feature; a right you remember
having. History records it (`{ event: 'pass', cardId }`) and the overlay's
spent view shows it dimmed with a *set aside* tag — refusals are part of the
piece's story too.

**Weight:** Trivial. One reducer action, one flag (`passUsed`), one link.

### 5.4 Culling the deck — pre-session composition *(strong candidate, second wave)*

**What:** Between setup and the opening, a brief beat: the session's deck is
laid out face-up (the overlay's remains grid again — set-knowledge is free),
and the player **removes N cards** (say 3) before the shuffle. Possibly also:
add +1 copy of one design. Then it's shuffled and never ordered again.

**Why it works:** Deck *composition* is the largest control surface in the
whole design, and today the player has none of it. Choosing what you might
encounter — while keeping zero knowledge of when — is the purest possible
expression of §2. It's also deeply studio-toned: you prep your chemicals
before the darkroom session; you choose which brushes come to the easel.
Sessions gain intent before the first image appears ("tonight I want no
grafts, all washes and grain").

**Costs:** Adds a screen and a decision before the opening — the current
cold-open into the image grid is clean and fast, and this taxes it. Also
risk: players who always cull the same three cards are just editing
`MOD_CARDS` slowly; if everyone culls the same cards, that's deck-tuning
feedback, not a mechanic. Mitigate by keeping N small.

**Name:** the beat is **the cut** (you cut the deck before play — and "cut"
is a press/film word too). Verb in UI: *Cut three.*

**Weight:** Light-medium. Reducer: build deck → `CUT` action removes ids →
shuffle. One pre-opening panel reusing the tile grid. All tuning in
`TUNING`.

### 5.5 Recalling the stash — player-timed return *(sleeper — maybe the best pure-design idea here)*

**What:** Today the stash returns at a fixed beat (after Act I). Instead:
the stash returns **when you call it** — any between-rounds moment, in place
of a deal. The gamble: once death is armed, every deal you take instead of
recalling risks the session ending with your stashed image *never placed*.
(Coda dealt with stash in hand → it stays unplaced; the overlay's record
shows it — *held, never placed*.)

**Why it works:** It converts a scripted beat into a live wager the player
carries all session — real control (you choose the moment the second image
enters, which is a major compositional decision) bought with real risk (hold
too long and lose it). This is "the perfect blend of random and control" in
one mechanic, and it costs nothing in surprise — it *adds* a source of
tension that isn't the deck's randomness but your own greed. It also
deepens the opening pick retroactively: "which image can afford to arrive
late — or never?"

**Costs:** Removes a reliable structural beat (the guaranteed mid-session
re-anchoring that the stash return currently provides — some sessions will
now front-load or lose it, and pacing gets more variable). Changes the
session script materially — this is an arc change, not an addition, so it
wants its own playtest round, alone.

**Name/UI:** a second, quieter button on the deal panel: **Recall the
stash**. Deal / Recall side by side is the whole mechanic, visible every
round, no explanation needed.

**Weight:** Light in code (reducer: allow `RECALL` in WORKING between
rounds → STASH_RETURN phase; remove the automatic trigger), heavy in
*consequence*. Tuning question: is recall allowed in Act I at all, or does
it unlock after round 2?

### 5.6 The proof sheet — the record as artifact *(build eventually; answers §3c — expanded by §9)*

**What:** At every universal bake, keep a small snapshot (thumb-scale, in
memory). At the Coda, alongside the export, offer **the proof sheet**: one
contact-sheet PNG of the piece's states in sequence — round by round, each
under its card's name.

**Why it works:** It's the loss-aversion answer (§3c): work is never erased,
it's stratified, and the strata are now a thing you can hold. It makes the
*session* — the actual subject of this tool — visible as an object for the
first time. Artists will pin these up. It also quietly markets the tool's
philosophy better than any copy could: the proof sheet of a good session is
an argument for commitment-based making.

**Costs:** None to gameplay (purely additive, post-death). Memory cost
trivial at thumb scale (~12 images × ~100 KB).

**Name:** **the proof sheet** (darkroom contact proofs — tone-perfect).

**Weight:** Medium. Editor-side only: snapshot at bake (a ~400px-wide
`toCanvasElement` of the master proxy), compose a grid canvas at the end,
extend `/api/export` or add `POST /api/export-proof`. Zero deck.js change
(the history log already names each round's card — it becomes the caption
track).

### 5.7 Riffle — scry N, reorder *(hold in reserve)*

**What:** A card: look at the top 3 of the deck, put them back in any order.
Pure order-knowledge + order-control, no card selection.

**Verdict:** Hold. It's a good card, but it overlaps both Cull (5.1) and
Skim (5.2) in the same design budget, and three near-neighbors dilute the
register. If Cull and Skim both prove fun, Riffle is the natural third; if
either flops, Riffle inherits its slot. (Name is right when its time comes:
riffling the deck.)

### 5.8 Fork — deal two, keep one *(reject for now)*

**What:** A card or rule: next deal reveals two cards; play one, the other
is set aside/buried.

**Verdict:** Reject as a standing rule — it halves the forced-commitment
essence at every single deal; that's a different game (a draft game). As a
1-copy card it's defensible but it's strictly blunter than Cull: Cull says
"choose from everything, once"; Fork says "choose from two, once." When you
only get one tutor-shaped card, take the sharper one.

---

## 6. Considered and rejected (kept honest, with reasons)

**6.1 Protection / fixative mechanics** ("paint a region that future cards
can't touch"). Rejected: it's layer management wearing a trenchcoat — the
exact thing v2 killed. A protected region is a layer that never dies; it
fights "every End flattens," reintroduces cross-End state (Pore's machinery
died for this), and mechanically answers a fear that §3a shows is already
answered by influence controls and the mask brush. If the fear needs more
medicine than the overlay provides, the proof sheet (5.6) treats the cause
(erasure of record) rather than the symptom (change of pixels).

**6.2 Full order visibility.** The subject of §1. Rejected as default;
survives only in paid fragments (Skim, Riffle).

**6.3 Timed deck preview** (see the full shuffled order for 10 seconds at
session start, then it hides). Rejected: converts the session into a memory
test — maximally gamey in the bad sense, and it punishes exactly the
players who immerse deepest and forget.

**6.4 Adaptive / reactive deck** (dealing weighted by canvas state — dark
canvas draws brightening cards). Rejected: violates deck.js purity (the
reducer would need eyes), and worse, corrupts trust — the moment a player
suspects the deals are curated, the deal stops being an oracle and starts
being a DM fudging dice. The deck's honesty is a feature. If curation is
ever wanted, it belongs in visible pre-session composition (5.4), not in
hidden weighting.

**6.5 Death-crop** (the parked v2 variant: the Coda offers one terminal crop
before export). Not rejected — *re-raised*, gently: Deeper's frame-rect
machinery now exists and is proven, so the implementation excuse is gone.
But it remains a pacing/philosophy call (does the Coda stay absolute?), it's
orthogonal to the visibility work, and it deserves its own conversation.
Parked, explicitly, again.

**6.6 A practice bench** (freeplay mode: pick any card, learn its feel, no
session). Not a session mechanic at all, so out of scope here — but noted
because it's where "I just want to see what the cards do" belongs, so that
urge never pressures the session design into legibility it shouldn't have.

---

## 7. Recommendation — what to actually do, in order

> Superseded in part by §10 (same-day addendum) — read §8–§10 before acting
> on this list.

Small doses, one wave at a time, playtest between:

1. **Wave 1 — cash in the overlay.** Build **Cull** (5.1, Stew's tutor) and
   **Skim** (5.2), one copy each, replacing nothing (deck grows to ~20 mods;
   retune later if acts feel long). They're both light builds on machinery
   v4 just shipped, they're both *cards* (so they arrive by chance —
   control dealt by the deck itself, the most Deck-flavored way to add
   control), and they directly exercise the new visibility in play.
2. **Playtest question for Wave 1:** does the splash-over tension survive
   now that remains-knowledge + occasional order-control exist? (Prediction:
   it mostly dissolves — §3b.)
3. **Wave 2 — only if the "forced commitment" complaint survives:** the
   **pass** (5.3). One right, quiet UI.
4. **Wave 3 — the arc experiments, separately:** **recall the stash** (5.5)
   alone for a session or three (it's the most interesting and the most
   destabilizing — isolate it), then **the cut** (5.4) if sessions want
   more pre-loaded intent.
5. **Anytime, independent:** **the proof sheet** (5.6) — pure addition, no
   gameplay risk, disproportionate soul.

And one non-action, stated as a decision: **the deal stays blind, and the
remains stay unordered.** That line is now policy (§2), and every mechanic
above exists to make spending small exceptions against it feel expensive
and delicious.

---

## 8. Addendum (2026-07-05, same day) — Deeper is the keystone

Stew's observation: Deeper is the most important card in the deck because it
is the **pace-setter**. A composition can always continue if you go inward —
crop into a quieter, more negative region and that region becomes the new
canvas. It refreshes an overly busy piece. This is why Deeper keeps
resurfacing at the center of the design.

### 8.1 Why Deeper is structurally unlike every other card

Naming precisely what makes it special:

- **It is the only entropy valve.** Every other card *adds or transforms*
  density — grafts deposit, brushes deposit, washes shift, even Etch adds.
  Only Deeper can take a saturated canvas and produce *emptiness* to work
  into, by selecting a negative-space region as the new whole. In systems
  terms: every session's entropy curve rises monotonically *except* where a
  Deeper resets it. A session without one must resolve inside its initial
  compositional space; a session with two can *travel*.
- **It is the only card that changes what the piece is about.** Everything
  else modifies the subject; Deeper *selects a new subject*. It's the
  highest-agency moment in the deck — a decision about meaning, not surface.
- **It is already the pacing card, covertly.** Session length is fixed by
  the deck, but *compositional* length — how much room the piece has left —
  is set by Deepers drawn. "The piece is nearly done" and "a Deeper just
  landed" are opposite states even at the same round count.

So the instinct is right: Deeper isn't one card among nineteen. It's a
structural organ that happens to be distributed *as* a card. The question
§8.2 takes seriously: should it stay one?

### 8.2 Deeper as a held resource — "descents in hand"

Stew's proposal, two flavors: (a) session length scales with how many
Deepers you're willing to go; (b) Deeper leaves the deck entirely — you hold
~3 of them, usable whenever, and each use **delays the Coda**.

("Lifelines" is the natural analogy and exactly the word the UI must never
use — game-show register. In the studio register they are Deepers held **in
reserve**; using one is a **descent**.)

**Why this is strong — the pacing control is diegetic.** The deep insight in
(b): players never choose a session length from a menu (settings-menu-brain,
anti-tone). Instead they make a *creative decision* — "this piece needs to go
inward" — and more time is the *consequence*. Length control without a
length control. The metaphor carries the mechanics perfectly: descending
into the piece literally opens new territory, so of course the journey
lengthens. Compare: an abstract "extend session" button would be
indefensible; "I cropped into the negative space and the piece re-opened" is
self-justifying.

**The delay, mechanically (clean version):** using a reserve Deeper
shuffles **K fresh mod cards into the remaining deck** (K ≈ 3–4, drawn from
the unused copies / a side pool — one knob in `TUNING`). Death cards are
*not* removed — they get **diluted**, so the Coda still looms but its odds
drop and expected time extends. This is pure-reducer-friendly (list
operations only), it respects "no session round-cap" (pacing stays
deck-composition-shaped), and it has a beautiful v4 synergy: **you watch the
remains view grow** when you descend. The overlay makes the bought time
*visible*.

**What (b) costs — the forced descent.** The dealt Deeper has a magic the
held Deeper loses: *being sent inward when you didn't choose it*. "The deck
says: find a new subject NOW" is response-mode creativity (§1.2) at its most
intense — some of the best moments this tool can produce are unwanted crops
that turned out to be the piece. A held Deeper is always used at the
convenient moment; convenience is the enemy of the interesting. Pure (b)
trades away forced descents entirely.

**The hybrid worth testing (recommendation):**

- **1 Deeper stays in the deck** (down from 2) — the forced descent
  survives as an event. Dealt Deepers do *not* extend the deck; they're a
  crop, as today.
- **2 Deepers sit in reserve** — visible as two small face-up cards at the
  panel's edge (the v4 `<Card>` component, tile size, already built).
  Usable between rounds (in place of a deal, like the stash-recall shape in
  §5.5). A reserve descent crops *and* dilutes the deck with K fresh mods.
- **The reserve is finite and visible from round one.** Carrying unspent
  descents to the Coda should feel like a choice, not a failure — the proof
  sheet (§9) records "two descents, one unspent."

**The natural depth limit is already physical.** Each descent re-restores
detail through the ×4 ESRGAN pass; compounding crops compound invented
detail, and by the third or fourth descent the grain goes soft. The ML
ceiling *is* the depth gauge — ~3 descents per session is what the material
itself supports. The reserve count isn't arbitrary; it's the number the
medium can bear. (Worth verifying empirically on real sessions — if quality
dies at 2, the reserve is 1+1.)

**Tuning interactions to watch:** descents + Cull/Skim (§5.1–5.2) are all
agency injections; shipping them together muddies each one's playtest. And
if a descent dilutes an armed deck, `progressLabel`'s "late — the Coda is in
the deck" stays true but the *feel* of late-game shifts — the label may want
gradations ("the deck runs thin" / "the Coda is close").

### 8.3 Session length as identity, not setting

Reframing flavor (a) through (b): "how long do I want to go" stops being a
pre-session choice and becomes a *running negotiation with the piece*. Short
sessions = never descending: the piece resolves in its first space,
compact, a sketch. Long sessions = descending twice: the piece travels,
archaeology of its own earlier states. Neither is configured; both are
*played*. This is the strongest version of "balance of random and control"
anywhere in these notes: the deck controls *what arrives*, the player
controls *how deep the piece goes*, and neither lever touches the other's
domain.

---

## 9. Addendum (2026-07-05, same day) — the state cache: every End, kept

Stew's second thought: cache the composition after every change as an image
as the session runs, show them all as a grid, and — the sharp part — **let
the player export a middle state**, not just the final one. "We ended up
making it worse" is a real session outcome; why lock the better version away?

### 9.1 What this collides with, stated honestly

This is the first idea in these notes that touches the commitment philosophy
head-on. "Every End is irreversible" has quietly meant two things at once:

1. **You cannot work from an earlier state.** (Process is irreversible.)
2. **The piece IS its final state.** (The artifact is singular.)

The state cache with mid-state export keeps (1) fully intact — the session
still only moves forward, no stroke is ever un-committed, the Coda still
ends everything — but breaks (2). The question is whether (2) was ever
actually load-bearing, or just came along for the ride.

The case that it's load-bearing: if any committed state can be the keeper,
late rounds get a safety net — "whatever happens, round 5 is banked" — and
the End button loses some of its cliff-edge. Sessions could drift toward
*best-state search* (play on riskily because you can always fall back to the
banked print) rather than *making a piece*. The Coda's arrival changes from
"this is what the piece is" to "now I go shopping among what it was."

### 9.2 The printmaking frame — states of the plate

But there is a strong counter from the medium this tool already borrows its
soul from. In printmaking, an etching plate exists in **states** — first
state, second state, third — and printmakers pull proofs at each. The states
of Rembrandt's plates are all legitimate works; collectors prize
intermediates. Nobody calls a second-state print "save-scumming."

The crucial detail that keeps commitment intact: **the plate only moves
forward.** You can pull a print of the plate *as it stands*; you can never
restore the plate to how it stood. Applied to Deck:

- The master is the plate. Every End advances it, irreversibly. (1) holds
  absolutely.
- Each committed state may be **pulled as a print** — exported — because it
  genuinely existed. What's forbidden is *continuing* from an old state.
- The final state remains "the piece" by default; earlier pulls are
  explicitly *states* (`state_03_of_09.png`), named as such in the files.

Under this frame, (2) was never the philosophy — it was an accident of not
having a cache. The philosophy is *the work only moves forward*, and that
survives whole. The safety-net worry from §9.1 doesn't vanish, but it
shrinks: you cannot *improve* a banked state, cannot composite two states,
cannot re-enter one. You can only have been there once.

### 9.3 Proposed shape (subsumes §5.6's proof sheet)

- **Capture:** at every universal bake, snapshot the master to a JPEG blob
  (quality ~0.92) in memory, labeled by round and card (`history` already
  carries the caption track). ~1–3 MB × ~12 rounds — trivial. The final
  state stays PNG-lossless as today. (Within-round intermediate states are
  *not* captured — inside a round you have undo; the cache is of
  commitments, not gestures.)
- **View:** the states grid — either a third section in the deck overlay
  (SPENT · REMAINS · STATES) or its own overlay. Each state under its
  card's name: *after Ghost · after Silt · after Deeper…* This is the proof
  sheet (§5.6) made interactive, and it's also the strongest possible
  answer to the splash-over tension (§3c): your buried work is *right
  there*, one click deep, forever part of the piece's record.
- **Pull:** at the Coda (COMPLETE phase only — no exporting mid-session,
  the session isn't a store), the states grid allows marking states to
  export alongside the final. Files named as states of the work, not as
  alternatives to it.
- **Plus the contact sheet:** the one-image proof-sheet composite of §5.6
  stays as an option — grid and sheet serve different moods (browsing vs
  pinning up).

**Open question to resolve in playtest:** does mid-state pulling change how
late rounds *feel*? If the banked-state safety net measurably loosens the
session's spine (§9.1's worry), the fallback position is: states grid +
proof sheet at thumbnail scale (the record survives), full-res pull of the
final only. Capture the JPEGs either way — the data costs nothing and the
decision stays reversible.

**Implementation weight:** Medium, Editor-side only. Bake hook snapshot →
in-memory array; states UI reuses the overlay patterns; export extends
`POST /api/export` with a filename hint (or a `/api/export-state` sibling).
Zero `deck.js` change — the reducer's history log already names every
state. Restart clears the cache (tab-close already loses everything — the
cache is session-local by design, like the rest of the piece).

### 9.4 What the cache quietly unlocks later (noted, not proposed)

Once every committed state exists as an image, several parked ideas get
cheaper: the proof sheet (§5.6, now a rendering of the cache), a session
replay (states cross-faded in order — a lovely artifact for sharing process,
very studio), and the death-crop's richer cousin (the Coda offering a final
crop *of the final state* — §6.5 — could show the states grid as context
for that choice). None of these are commitments; all become one-day builds
on top of the cache.

---

## 10. Revised recommendation (supersedes §7's ordering)

The §7 waves still stand, re-sequenced around the addenda — and with a
budget warning: §5 and §8 together propose *a lot* of new agency. The whole
point of this tool is that the deck is in charge; every mechanic below
spends against that. Ship in small doses, playtest each dose, and be ready
to *not* ship the later waves if the deck starts feeling like a menu.

1. **Wave 1 — the state cache + states grid (§9), capture-and-view only.**
   Moved to the front: it's Editor-side, zero philosophical risk at
   view-only scope, it answers the splash-over tension better than any
   mechanic (§3c), and every session it runs builds the evidence for the
   §9.3 pull decision. Decide mid-state *pulling* after living with the
   grid for a while.
2. **Wave 2 — Cull + Skim (§5.1, §5.2).** As before: the overlay cashed in,
   one copy each, light builds.
3. **Wave 3 — the descent experiment (§8.2 hybrid), alone.** 1 Deeper dealt
   + 2 in reserve, descents dilute the deck. This is the deepest structural
   change proposed anywhere in these notes — isolate its playtest. Verify
   the ESRGAN depth ceiling empirically while at it.
4. **Wave 4 — only as needed:** the pass (§5.3) if forced-commitment
   complaints survive Waves 1–3; recall-the-stash (§5.5) and the cut (§5.4)
   remain on the bench; Riffle (§5.7) inherits a slot only if Cull or Skim
   flops.

5. **Anytime, small:** the card-grid scale fix (§11.1) — pure QOL, no
   design risk, fits in any gap between waves.

The through-line of all three conversations in this document: **the deck
stays sovereign over *what arrives*; the player gains sovereignty over
*depth* (descents), *knowledge* (the overlay, Skim), and *memory* (the
states). Arrival, depth, knowledge, memory — four separate axes, and the
design stays healthy as long as each mechanic lives on exactly one.**

---

## 11. QOL notes & future concepts (2026-07-06)

Small items from Stew — not mechanics, but recorded here so they don't get
lost between waves.

### 11.1 Card-grid picks need scale *(QOL — built 2026-07-06, awaiting browser verification)*

When a card deals its own image grid (Ghost/Stain's grid of 8, Stamp's
grid of 6 — any `CardGridPicker` consumer), the images are the *entire
decision* — and right now they're too small to judge. The cause is in the
CSS: `.grid-thumbs` uses `repeat(auto-fill, minmax(150px, 1fr))` with
`align-content: start`, so a handful of ~150px thumbs huddle at the top of
the canvas area and the rest of the space sits empty. The opening grid
already solved this problem for itself (`.grid-thumbs.opening` computes a
`--cell` size from the container via container queries so 6×4 always fills
the area); the card grids never got the same treatment.

**Fix:** give `CardGridPicker` the opening's fit-to-area approach,
generalized for small N — pick a column count by image count (8 → 4×2,
6 → 3×2), compute the cell size from container width *and* height like the
opening does, and let the images be as large as the area allows. A choice
among eight images should feel like laying prints on a table, not
squinting at contact frames. Purely `GridPicker.jsx` + `editor.css`; no
deck or card changes.

(While in there: the same scale check applies to any future grid consumer
— Cull's §5.1 card-pick grid reuses the overlay's tile grid and is fine at
tile scale since card faces are known quantities, but *image* picks are
always judged-by-eye and deserve maximum area.)

### 11.2 The plinth — a three.js viewer for the finished piece *(future, just for fun)*

Stew's concept: when the piece is complete, offer a viewer where the final
composition sits on a **floating panel with slight physical depth** — a
stretched-canvas / mounted-board look — in a three.js scene. You grab it
and orbit; you zoom in close. Not a mechanic, not part of the session: a
way to *behold* the thing you made, the way you'd pick up a finished print
and tilt it in the light.

Notes for when this gets built:

- **Tone-safe by nature** — galleries, plinths, and racking a canvas to
  the light are pure studio register. Keep materials matte and the scene
  dark/neutral (the existing UI palette); no gloss, no skybox, no
  showroom floor.
- **The master is the texture** — 2400×3000 is a perfectly reasonable
  texture size; the zoomed-in inspection is genuinely full-res. Slight
  edge wrap (the image continuing around the panel's ~2–3% depth, like a
  gallery wrap) would sell the object-ness cheaply.
- **Where it lives:** the COMPLETE phase, next to the export — a `view
  the piece` button opening a full-canvas-area viewer (or the whole
  window). Orbit + zoom only; no editing affordances whatsoever.
- **Dependency note:** this adds `three` to a codebase that deliberately
  has few dependencies — worth it only when the feature is actually
  wanted. A cheaper spike exists (CSS 3D transform on a div with the
  export image + drag-to-tilt), which would prove the *feel* before
  committing to a real renderer. If the states cache (§9) exists by
  then, a stretch idea: flip the panel over to find the proof sheet
  printed on the back.
