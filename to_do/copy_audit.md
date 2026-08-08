# Copy audit — plainer language pass

> **STATUS: APPLIED** — all 44 Proposed entries below were written to
> `frontend/src/copy/uiText.json` on 2026-08-08 (Stew's edited versions,
> verbatim). §4's THE WORKING DECK stayed "borderline" with no ruling, so that
> title is unchanged. This file is now the record of the pass.

> **What this is.** An audit of all user-facing copy (`frontend/src/copy/uiText.json`)
> for places where the "poetic, not literal" directive overshot — language so
> abstract it stops explaining the application. Each entry proposes a plainer
> alternative. Stew edits this file, then a single Claude Code pass applies it.
>
> **Conventions for editing this file:**
> - Every entry names its exact `uiText.json` key path. The **Proposed** line is
>   the text that will ship — edit it freely.
> - **Delete an entry entirely** to reject it (current text stays).
> - Entries marked *(minor)* are grammar/consistency fixes, not tone problems.
> - Out of scope, per Stew's ruling: card **names** stay; ids stay; "Coda" as
>   the on-screen name stays.
>
> **Calibration used.** Flagged: copy where the register hides what the control
> or card does. Kept: copy where the register still states the mechanics plainly
> (benchmark: the deck overlay's "Spent — in sequence / Remains — in no order",
> and the deck-dock hint "it bakes in for good, and the next card turns over").
> A "kept on purpose" list is at the bottom so those judgments can be overruled too.

---

## 1. Card descriptions (`cards.*`)

These show in the deck overlay / card views, so they're the one place a player
learns what a card *does*. Right now the register swings wildly — `hue` is a
spec sheet ("Apply HSV modification"), `rack` is a wine cellar. All proposals
below follow one house shape: **plain mechanics first, one short register
clause at most.** Every rewrite is checked against the card's behavior file.

### `cards.ghost.description` *(minor)*
- **Now:** "Add screen blend mode image onto canvas. Only the light survives. "
- **Why flagged:** Grammar ("Add screen blend mode image"), trailing space. The flourish is fine — it's accurate.
- **Proposed:** "Place a second image over the piece with a screen blend: only its light values survive."

### `cards.stain.description` *(minor)*
- **Now:** "Add an image overlay with a multiply blend mode onto the canvas. Darkness multiplies."
- **Proposed:** "Place a second image over the piece with a multiply blend: only its dark values survive." *(parallels Ghost, and matches its own pickHint)*

### `cards.reverberate.description`
- **Now:** "One subject, struck again and again — every stroke lays it down in echoes."
- **Why flagged:** Pure mood; never says it's a brush you paint with.
- **Proposed:** "Cut out an image's subject and paint with it — every stroke lays down repeated stamps along its path."

### `cards.rails.description`
- **Now:** "Adds a fractured monochromatic shard onto the canvas."
- **Why flagged:** "Fractured monochromatic shard" sounds like an effect that happens *to* you; the card actually hands you a stencil to arrange and color.
- **Proposed:** "A random image is broken into fragments that arrive as a flat, single-color stencil. Arrange it, set the color, erase what you don't want."

### `cards.char.description`
- **Now:** "The fragments keep the photo's tones as char — arrange them, darken them toward black."
- **Why flagged:** "The fragments" assumes context the reader doesn't have (it reads as a sequel to Rails).
- **Proposed:** "A random image is broken into fragments that keep the photo's own pixels. Arrange them, then darken and desaturate them toward black."

### `cards.deeper.description`
- **Now:** "The frame is the piece's next edge. Move it, scale it from the corners, rotate it — whatever it holds becomes the whole canvas."
- **Why flagged:** Opening line is abstract, and the card's defining feature — detail is *restored* into the enlargement (upscale) — is missing entirely.
- **Proposed:** "Frame a region of the piece and crop to go deeper into the image. Upscaling restores the pixel values by 4x."

### `cards.closer.description`
- **Now:** "The same frame, but honest — whatever it magnifies keeps only the pixels it started with. Zoom in and the grain shows."
- **Why flagged:** "But honest" is an in-joke against Deeper; "the grain shows" undersells that pixels turn into hard blocks.
- **Proposed:** "Frame a region of the piece and crop to get closer into the image. No upscaling, faithful to the pixels."

### `cards.rack.description`
- **Now:** "The piece is racked to a new vessel: drag, scale, rotate. What leaves the frame is gone; what the frame exposes stays white."
- **Why flagged:** "Racked to a new vessel" is wine-cellar jargon for a move/scale/rotate of the whole canvas. The strongest example of the problem in the file.
- **Proposed:** "The whole piece comes loose as one object: drag, scale, rotate, flip it. Whatever leaves the canvas is cut off; whatever the move uncovers stays white."

### `cards.dust.description` *(minor)*
- **Now:** "Paint where the dust should settle. Nothing changes until you paint."
- **Why flagged:** Never says what dust *is*. Structure is good.
- **Proposed:** "Paint monochrome grain onto the piece. Nothing changes until you paint."

### `cards.blur.description` *(minor)*
- **Now:** "use a brush to blur the surface of the canvas."
- **Why flagged:** Lowercase; otherwise fine.
- **Proposed:** "Paint blur onto the piece with a brush. Nothing changes until you paint." *(matches Dust's shape — it's the same kind of card)*

### `cards.steep.description`
- **Now:** "The piece steeps in a dye bath. Influence is steeping time."
- **Why flagged:** Doesn't mention the actual controls (a color and a blend mode). "Influence is steeping time" is the good kind of flourish — kept.
- **Proposed:** "Flood the whole canvas with one color - pick the dye and the blend mode. Influence is steeping time."

### `cards.hue.description` *(minor)*
- **Now:** "Apply HSV modification to the entire canvas."
- **Why flagged:** The opposite failure — pure spec-sheet, and "HSV" is programmer vocabulary.
- **Proposed:** "Shift hue, saturation, and brightness across the whole canvas. Influence sets how strongly it applies."

### `cards.cure.description`
- **Now:** "The piece cures in its own bath — mids deepen, tone richens. Influence is how far the cure has gone."
- **Why flagged:** Nothing states the mechanic (the piece blended over itself); "mids deepen, tone richens" is the effect and can stay.
- **Proposed:** "The piece is blended over itself - contrast deepens, midtones richen. Influence is how far the cure has gone."

### `cards.etch.description` *(minor)*
- **Now:** "Etch a small glyph at the grain. At full size it will be almost nothing."
- **Why flagged:** "At the grain" only makes sense after you've played it once. Last line is good.
- **Proposed:** "Place a small frame, zoom to its pixels, and draw a glyph square by square. At full size it will be almost nothing."

### `cards.searcher.description`
- **Now:** "Pick a card from the deck, this becomes your next turn."
- **Why flagged:** Comma splice, and "turn" is on the banned list (§1 tone: prefer "round"). Also misses that the chosen card starts immediately.
- **Proposed:** "Look through everything left in the deck and take any card. The chosen card is the next action."

### `cards.skim.description`
- **Now:** "Reveal the next card, choose to play it or re-shuffle it into the deck."
- **Why flagged:** "Play it" is arcade vocabulary (banned list), and the card's own UI says leave/bury — the description should match.
- **Proposed:** "Turn the deck's top card face-up. Leave it on top for the next deal, or bury it back into the deck."

### `cards.delay.description` *(minor)*
- **Now:** "The first Coda card can be skipped. The Coda card is shuffled back into the deck when skipped. It may appear again next turn anyway."
- **Why flagged:** "Turn" again; repetitive; "skipped" vs the UI's "set aside".
- **Proposed:** "The first Coda dealt can be set aside, once. It shuffles back into the deck and can return on the very next draw."

### `cards.transfer.description` *(minor)*
- **Now:** "The whole piece has been redrawn. Erase to cut the original back through; influence sets how strongly the redraw sits."
- **Why flagged:** "Has been redrawn" — by what, into what? One word fixes it; the second sentence is already the house shape.
- **Proposed:** "The whole piece is redrawn in a painted style. Erase to cut the original back through; Influence sets how strongly the redraw sits."

### `cards.shatteredTransfer.description`
- **Now:** "The piece’s redraw shows through another image’s most shattered form."
- **Why flagged:** Fourteen words, three abstractions, zero mechanics.
- **Proposed:** "The piece is redrawn in a painted style, but the redraw shows through only where a stencil sits — a stencil cut from another image's fragments. Drag it, scale it, erase through it."

### `cards.stashReturn.description` *(minor)*
- **Now:** "The image you held back comes home. Place it into the piece as it now stands."
- **Proposed:** "The image you stashed returns. Place it into the piece as it now stands."

*Kept as-is: `stamp`, `lift`, `fracture`, `bruise`, `coda` — all already state
their mechanics plainly.*

## 2. Card hints (`cardHints.*`, `shared.*`)

### `shared.shattering`
- **Where:** Progress line while Rails / Char / Shattered Transfer analyze an image
- **Now:** "Reading the image for its most shattered form…"
- **Why flagged:** As a progress message it should say what's happening, not name a concept.
- **Proposed:** "Breaking the image into fragments…"

### `cardHints.transfer.working`
- **Where:** Transfer, while the style redraw computes
- **Now:** "The piece is being redrawn in another hand… a few seconds."
- **Why flagged:** "In another hand" is the poetic name for the one fact worth stating: it's being restyled.
- **Proposed:** "Redrawing the piece in a painted style… a few seconds."

### `cardHints.shatteredTransfer.pickHint`
- **Where:** Shattered Transfer's image grid
- **Now:** "Six images. Take one — it won't be placed; it will be read as a stencil, and the piece's redraw shows through its shattered form."
- **Proposed:** "Six images. Take one — it isn't placed as pixels. Its fragments become a stencil, and the restyled piece shows through wherever the stencil sits."

### `cardHints.shatteredTransfer.arrangeWaiting`
- **Now:** "This image {reading} — place the stencil where the style should break through. The redraw is still arriving; the window opens when it lands."
- **Why flagged:** "The window opens when it lands" — window of what, lands where?
- **Proposed:** "This image {reading} — place the stencil where the restyled piece should show through. The redraw is still computing; the stencil goes live when it arrives."

### `cardHints.shatteredTransfer.windowOpen`
- **Now:** "The window is open{readingClause}. Drag, scale, rotate the stencil; the redraw shows through wherever it sits."
- **Proposed:** "The redraw has arrived{readingClause}. Drag, scale, rotate the stencil — the restyled piece shows through wherever its fragments sit."

### `cardHints.shatteredTransfer.degraded` *(minor)*
- **Now:** "The transfer service is unavailable — the stencil is withdrawn and the piece stands as it is. Draw to move on."
- **Proposed:** "The transfer service is unavailable, so the stencil was removed and the piece is unchanged. Draw to move on."

### `cardHints.lift.takeHint`
- **Where:** Lift's tool panel, while dragging rectangles
- **Now:** "Drag a rectangle over the piece — on release a copy lifts free and follows your hand. Stamp as many as the round wants."
- **Why flagged:** "as many as the round wants" — the round doesn't want anything; the user decides.
- **Proposed:** "Drag a rectangle over the piece — on release a copy lifts free and follows your cursor. Stamp as many copies as you like before drawing."

### `cardHints.lift.carryHint`
- **Where:** Lift, while a copy is attached to the cursor
- **Now:** "Click to stamp the copy where it hangs. Esc discards it."
- **Why flagged:** "where it hangs" is vague about the one thing it needs to say: the copy is following the cursor.
- **Proposed:** "A copy is following your cursor — click to stamp it down. Esc discards it."

### `cardHints.searcher.emptyDeck`
- **Where:** Searcher dealt with nothing left in the deck
- **Now:** "The deck has nothing left to offer."
- **Why flagged:** Personifies the deck to say something with a two-word literal version.
- **Proposed:** "The deck is empty."

### `cardHints.searcher.toolWaiting`
- **Where:** Searcher's tool panel before a card is chosen
- **Now:** "Take the card the piece needs."
- **Why flagged:** Poetic imperative; doesn't say what actually happens (you're choosing your next card).
- **Proposed:** "Pick any card from the deck — it becomes this round's card."

### `cardHints.searcher.toolReady`
- **Where:** Searcher resolved on an empty deck
- **Now:** "The deck had nothing left to offer — a round with no modification. Draw to end it."
- **Proposed:** "The deck was empty, so this round changes nothing. Draw to end it."

### `cardHints.delay.toolSuffix`
- **Where:** Delay's tool panel after it resolves
- **Now:** "The right is held from here on. Draw to end the round."
- **Why flagged:** "The right is held" is legal abstraction; a first-time player has no idea what right, held where.
- **Proposed:** "Delay is now held: when the first Coda is dealt, you can set it aside once. Draw to end the round."

### `cardHints.stashReturn.previewHint`
- **Where:** Stash Return preview, before placing
- **Now:** "The image you held back, before it lands. Look at it against what the rounds since have made — then bring it in and place it."
- **Why flagged:** First sentence is a fragment doing mood work; the instruction is buried.
- **Proposed:** "This is the image you stashed at the opening. Compare it with the piece as it now stands, then bring it in and place it."

### `cardHints.stashReturn.previewFoot`
- **Where:** Stash Return preview footer
- **Now:** "It comes home either way — there is no putting it back."
- **Proposed:** "It joins the piece either way — it can't be stashed again."

## 3. Session panels & deck dock (`deckPanel.*`, `cardGate.*`, `editor.*`)

### `deckPanel.stashReturnNoticeHint`
- **Where:** Notice panel when the Stash Return card is drawn
- **Now:** "The card has come up: the image you held back returns — met by a piece that has moved on without it. It waits on the page; bring it in when you're ready to place it."
- **Why flagged:** "met by a piece that has moved on without it" is a short story; "it waits on the page" doesn't say where to look or what to click.
- **Proposed:** "The Stash Return card has come up: the image you held back is ready to rejoin the piece. Bring it in when you're ready to place it."

### `deckPanel.codaHint`
- **Where:** The Coda panel, when Delay is held
- **Now:** "The deck says the piece is finished. You still hold Delay — accept the ending, or set the Coda aside. It slips back into the deck and the next deal is blind: it can come straight back, and the right is spent."
- **Why flagged:** "the next deal is blind" and "the right is spent" are the two facts the player must weigh, and both are abstracted.
- **Proposed:** "The Coda has been dealt — accepting it finishes the piece and ends the session. You still hold Delay: set the Coda aside and it shuffles back into the deck. It can come straight back on the very next draw, and Delay only works once."

### `deckPanel.stashReturnTitle` *(minor)*
- **Where:** Panel title while placing the returned stash
- **Now:** "STASHED IMAGE RETURN" (but the notice title is "THE STASH RETURNS")
- **Why flagged:** Two different names for the same moment, back to back.
- **Proposed:** "THE STASH RETURNS" (match `stashReturnNoticeTitle`)

## 4. Phase names — a decision list, not rewrites

Stew asked that phase names be on the table. Recommendation per name; overrule freely:

| Name | Where | Recommendation |
|---|---|---|
| THE OPENING | first panel title | **Keep** — literal (it is the opening pick) |
| PLACEMENT | placement panel | **Keep** — literal |
| THIS ROUND | active-card panel | **Keep** — plain |
| Act I / Act II | progress line | **Keep** — structural and clear, tells you death cards aren't in yet |
| THE CODA | end panel | **Keep** — card name, ruled in scope to stay |
| FINISHED | export panel | **Keep** — plain |
| THE COMMISSION / PLATE / PANEL / TYPE / PROOF | Foundry step titles | **Keep the nouns** — real print-shop terms that literally name the step; plain-up their body copy instead (§5) |
| THE WORKING DECK | Foundry post-press | **Borderline** — accurate but opaque on first read. Alternative: "THE WORKING ROUNDS" |

## 5. Foundry body copy (`foundry.*`)

### `foundry.plate.setHint`
- **Where:** Plate-choice hint
- **Now:** "The full set of {count} plate{plural} — choose the one this face calls for. Its frame is the card's convention layer; the white window is the punched image panel, waiting for art."
- **Why flagged:** "convention layer" and "punched image panel" are internal spec vocabulary (card_anatomy.md) leaking into UI.
- **Proposed:** "The full set of {count} plate{plural} — choose one. Its frame becomes the card's border art; the white window is where the image will go."

### `foundry.plate.runHint`
- **Where:** Run-size control hint
- **Now:** "Impressions this cast will pull — the same sealed base, deviating only after the Press. Taking the plate fixes the run."
- **Why flagged:** Three foundry abstractions in one line; the control is a number picker.
- **Proposed:** "How many versions this cast will produce. Each starts from the same sealed base and only diverges after the Press. Locked in when you take the plate."

### `foundry.type.pressNote`
- **Where:** Above the Press button
- **Now:** "The Press seals the whole foundation — art, plate, and type flatten to pixels for good. After it, the graffiti deck works the sealed face."
- **Why flagged:** "the graffiti deck works the sealed face" — neither "graffiti deck" nor "works" is explained anywhere the user has been.
- **Proposed:** "The Press is the point of no return — art, plate, and type flatten to pixels for good. After it, a small deck of cards marks up the sealed face."

## 6. The guide (`guide.*`)

### `guide.session.what.p1` *(one phrase)*
- **Now (the phrase):** "…the card decides the one thing the bench can do — a brush to compose with, a frame to move, a bath to steep in."
- **Why flagged:** "the bench" appears nowhere else in the app; "a bath to steep in" only lands if you already know the Steep card.
- **Proposed:** "…the card decides the one thing you can do that round — a brush to paint with, a frame to move, a color to soak the canvas in."

### `guide.deckEditor.rules.p1` *(one phrase)*
- **Now (the phrase):** "The cap is the point: a deck small enough to know is a deck whose remains you can read at the table."
- **Why flagged:** "read at the table" is card-table imagery standing in for the actual reason.
- **Proposed:** "The cap is the point: a small deck is one you can hold in your head — you always know roughly what's left."

### `guide.setup.doors.title` *(minor, borderline)*
- **Now:** "The two doors"
- **Why flagged:** Mild metaphor for what is literally two buttons; the body text does explain it. Fine to keep.
- **Proposed:** "The two ways in"

## 7. Setup, ML install, deck editor, keys, misc

### `plinth.leafHint` *(minor)*
- **Where:** Coda screen, state-cycling hint
- **Now:** "C — leaf through the states"
- **Proposed:** "C — step through earlier states"

*(`mlSetup.*` was already brought to plain language in the recent "Installing
dependencies" commit and reads clean throughout — no entries. `setup.*`,
`deckEditor.*`, `keys.*`, `opening.*` are already plain; see keep-list.)*

## 8. Hardcoded strings outside uiText.json — informational only

A full sweep of the frontend + backend found **no tone violations of
consequence outside the copy file**. Per Stew's ruling, hardcoded strings stay
as-is this pass; this section is just the map of what exists, for a possible
future coverage cleanup:

- **Single-word control labels** (`Size`, `Influence`, `Opacity`, `Seed`,
  `Undo`/`Redo`, `Soft`/`Hard`, `Flip H/V`…) are hardcoded in every card file
  and the shared factories — all plain, all fine.
- **Hover tooltips** are hardcoded and are actually good literal copy already
  ("How big the chunks are — bigger chunks slide farther", "Wobbles each
  impression's size and angle"). If anything, they're the model for this audit.
- **Backend error strings** (`server.js` folder validation, `image-source.js`
  fetch errors) render verbatim in Setup and are already plain.
- Three items squarely in the register, listed for awareness only:
  - `editor/Card.jsx:97-102` — the kind-line on art-less card faces:
    `'the deck is done'` / `'the stash'` / `'the deck'` / `'modification'`.
  - `editor/shatter.js:29-33` — `READING_LABEL` ("shattered along its darks /
    midtones / edges") fills `{reading}` in `shared.shatteredIntro`, so half
    that sentence lives outside the copy file. The text itself is informative
    — keep — but any future edit to the shatter copy must touch both files.
  - `editor/cards/searcher.jsx:74` / `skim.jsx:87` — `alt="The work as it
    stands"` on the work-glance thumbnail.

## Kept on purpose (spot-check me)

- `deckOverlay.*` — "Spent — in sequence", "Remains — in no order", "…and the
  Coda is somewhere in here." The register here *is* the information.
- `deckPanel.deckHintPlacement` / `deckHintActive` — "it bakes in for good, and
  the next card turns over" says exactly what the button does.
- `deckPanel.deckHintGate` / `deckDrawGate` — "let this card pass" is plain.
- `cardGate.passNote` / `committedNote` — clear on what is and isn't committed.
- `keys.*` — terse and literal throughout ("Restart. It destroys the piece, so
  it takes two keys." is the house voice working).
- `opening.hint` — long but every clause is instruction.
- `deckEditor.*` — already obeys the legibility clause.
- `cardHints.skim.*` — "Leave it or bury it — you won't see what replaces it"
  is register carrying real information (order stays hidden).
- `cardHints.ghost.pickHint` / `stain.pickHint` — "a second exposure: only its
  light survives" / "it soaks in: only its dark survives" are the register
  *explaining* the blend modes, not hiding them.
- `cardHints.deeper.commitNote` / `closer.commitNote` — plainly state the
  restore-vs-no-restore difference and the wait.
- `shared.shatteredIntro` + the `{reading}` labels — "This image shattered
  along its darks" tells you which analysis won; informative as-is.
- `cardHints.transfer.degraded` — clear about what failed and what to do.
- `foundry.proof.*` and `foundry.panel.*` — literal about files, folders, crops.
- `progress.*` — "late — the Coda is in the deck" is the plain fact.
