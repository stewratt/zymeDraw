# WORKLOG

Compact history of completed issues, newest entries first. Each entry:

```
## [NN] #<issue> — <title> (<date>)
What: 1–2 lines on what was done.
Where: main / PR #N (merged) / spawned #N, #N / closed-no-action.
Choices: any decisions the executor made on its own.
Files: the main files touched.
```

## [12] #99 — Foundry regression audit (2026-07-26)
What: read-audited every Foundry surface against the post-overhaul shell —
entry, plates, panel pick, type, the Press, all nine roster cards, run size,
export, keys, copy, and every shared `editor/` module the Foundry imports,
hunting the #97 class of Deck-only assumption. Four small findings fixed here;
four larger ones filed.
Where: PR #106 / spawned #102, #103, #104, #105.
Choices: (1) **Threshold** — "small" meant: no new shared abstraction, no
backend contract change, no new copy key, and confined to `foundry/` or a pure
copy edit. Everything touching a shared component's shape, a route's contract,
or the copy schema got filed. (2) The one real bug fixed: `currentCard` outlives
the WORKING phase (a dealt Proof stays in hand at COMPLETE), so the BEGIN effect
fired at the Proof screen, hit the no-entry branch, and armed a PencilBrush —
the finished cast sat in free-draw mode, scribbleable. Gated the effect on
`state.phase === 'WORKING'` (an arc condition, not a per-card branch) and added
`state.phase` to its deps. (3) Retired the no-entry scribble placeholder rather
than keeping it behind the gate: Phase 5 landed, every `FOUNDRY_CARDS` id
resolves in `foundryRegistry`, and the branch now mirrors Deck's Editor exactly
(ready immediately, canvas untouched). This dropped the last `fabric` import
from FoundryEditor. (4) Added the missing panel-pick error surface — the art
sources could fail with the grid stuck on "Dealing…" forever; it now prints
`artSources.error`, the way PlateDeal already prints its folder error. No new
copy key: the string is server-supplied, same as the plate's. (5) Judged
intel item 3 (empty-deck DEAL no-op) **unreachable by construction** — 13 cards,
proofs shuffled in at round 3, so a deal never meets an empty deck — and filed
nothing rather than add backlog noise. (6) Copy: the guide's foundry arc still
said "the foundry's End", naming a button #98 deleted, and never said how a
round ends; added a `rounds` beat mirroring `guide.session.bearings`. Also
retired "arrives in Phase 5" dev-speak and a grid hint that named a source mix
the dedicated panel-art folder makes false.
Files: frontend/src/foundry/FoundryEditor.jsx, foundry/FoundryPanel.jsx,
foundry/foundry.css, copy/uiText.json.

## [11] #98 — Foundry: adopt the deck-is-the-button draw dock (2026-07-26)
What: the dock (deck left, dealt card right, click-to-deal with the flip) moved
out of DeckPanel into its own shared module `editor/DeckDock.jsx`, and the
Foundry's working rounds now render that exact component. One click commits the
graffiti round and turns the next card; the Foundry's Deal button (dead since
#87 removed its copy key, so it rendered blank) and its "End — commit" button
are gone, along with the orphaned `deckPanel.endCommit` string and the
`button.commit` CSS rule.
Where: PR #101.
Choices: (1) Parameterization — **plain props, no wing flag**. Everything that
differs arrives as a prop, and the props for mechanics the Foundry lacks
(`stashCount`, `delayHeld`) default to off so it simply omits them; the dock
never learns which session it is in. Chosen over context/registry because the
component was already prop-driven and CLAUDE.md bans per-wing branches in shared
components. (2) Scope — only the WORKING rounds get the dock; the foundation
phases (take the plate, continue to the type, the Press) keep their own primary
buttons, since nothing is dealt at those crossings and the Press is deliberately
click-only. (3) Copy — the Foundry reuses `UI.deckPanel`'s draw lines rather
than getting its own, matching the existing "shared studio verbs read the same
in both wings" rule already stated in FoundryPanel's header. (4) Keys — Enter is
now one `handleAdvance` binding for both WORKING states, and the Foundry's
leftover **Space → Deal** binding is removed (Enter-only, per hotkeys.md §5.6);
recorded as decision 13 in hotkeys.md. (5) The Foundry's dealt card gained
click-to-zoom (CardZoom) for parity, since the face left the panel body for the
dock. (6) `handleCommit` split into `commitCurrentCard` (no dispatch) +
`handleAdvance` (COMMIT then DEAL in one tick), mirroring Editor.jsx exactly.
Files: frontend/src/editor/DeckDock.jsx (new), editor/DeckPanel.jsx,
editor/editor.css, foundry/FoundryPanel.jsx, foundry/FoundryEditor.jsx,
foundry/foundryDeck.js, copy/uiText.json, hotkeys.md.

## [10] #97 — Foundry: brush strokes double the image, offset toward top-left (2026-07-26)
What: the shared reveal/stamp overlays in `brushCore.js` were seated with Deck's
hardcoded 800×1000 artboard constants (a #53 change), so in the Foundry — whose
artboard is the 745×1040 card face — every effect-brush stroke revealed a
master-sized copy of the card stretched 7.4% wide and squashed 3.8% short: the
doubled, skewed ghost. Both overlays now seat at `1 / MASTER_SCALE`, the same
master→artboard ratio `showMaster` and Etch already use, which is correct in
both wings with no per-wing branch.
Where: PR #100.
Choices: (1) navigation model — the Foundry KEEPS its fixed, identity-transform
canvas; no pasteboard camera, per the spec's "diverge if simpler". It already
had no `fill` and no `attachCanvasNav`, so this is the zero-change option and
also the one that keeps the screen-constant brush (#71) trivially correct
(getZoom() === 1). Recorded as a header comment in FoundryEditor.jsx.
(2) Derived the scale from `MASTER_SCALE` rather than threading artboard dims
through the session options — the composite is master-sized by construction, so
the ratio is the same constant in both wings and nothing new crosses the API.
(3) Left `liftSession.js` and `placement.js` (same #53 constant treatment) alone
— neither is reachable from the Foundry roster; out of scope.
Files: `frontend/src/editor/brushCore.js`, `frontend/src/foundry/FoundryEditor.jsx`.

## [10] #92 (fix) — the Zoom In gate was backwards: it now COMMITS (2026-07-26)
What: #92 shipped the gate on the wrong side of the round — Closer/Deeper dealt
with no frame on screen, the button started the session, and the deck committed
it. Intended (and now built): the frame is live the moment the card turns over,
you arrange it, **Zoom In commits** the re-frame mid-round so the result is on
screen, and the deck click after that is only the next deal. `entryGate` became
`commitGate` throughout; the Tools prop `entered` became `committed`.
Where: main (direct fix commit).
Choices: (1) Kept the pass: drawing while the frame is still live lets the card
go by, uncommitted — that was the point of #92 and it survives the inversion.
But the session HAS begun now, so the pass runs the card's `cleanup` hook to
take the frame rect off the canvas; nothing bakes, nothing is captured. (2)
handleGateCommit reuses `commitCurrentCard` unchanged (hook → universal bake →
state capture) and simply doesn't dispatch COMMIT/DEAL — the one deliberate
break in "commit and deal land in one render", which is exactly what makes the
result visible. (3) It re-fits the camera by hand afterwards (`nav.setZoomBounds`
+ `nav.reset`): the bake leaves the viewport at identity and the re-fit effect
only runs at a deal, which this isn't. (4) Editor/DeckPanel still hold no
per-card branches — `cardCommitted` replaces `cardEntered` in the same generic
places (Overlay, `cardLive` bindings, the deck dock's hint/label). (5) Copy:
`cardEntry` → `cardGate` (zoomIn / passNote / committedNote), both card
commitNotes now say "Zoom In commits…" rather than "The draw commits…", and a
committed gated round borrows the existing idle deck hint/label.
Files: frontend/src/editor/Editor.jsx, frontend/src/editor/DeckPanel.jsx,
frontend/src/editor/cards/registry.jsx, frontend/src/editor/cards/
frameCardFactory.jsx, closer.jsx, deeper.jsx, frontend/src/copy/uiText.json.

## [09] #93 — Stash return deals into a preview page (2026-07-26)
What: Drawing the Stash Return card now fills the canvas area with a full-view
page — the card grids' chrome (head / fit area / foot), the stashed image shown
whole, no grid and nothing to pick — so the image is seen before it becomes
live. "Bring it in" sits in the page's foot and dispatches ACK_STASH_RETURN into
the existing live placement session, unchanged.
Where: PR #96.
Choices: (1) Expressed as a PHASE view in Editor's canvas area
(`state.phase === 'STASH_RETURN_NOTICE'`), rendered right beside the opening
grid and the plinth — NOT as a card `Overlay` and not as an extension of #92's
`entryGate`. The stash-return beat is already a phase in deck.js, never a
WORKING round, so it has no registry lifecycle to gate; entryGate also carries a
skip (draw to let the card pass), which the spec forbids here. This keeps
Editor.jsx free of per-card branches: it branches on phase, as it already does.
(2) The deck-click question: the dock is not rendered on this beat at all —
inert would still show a deck that does nothing, and the two other full-page
decisions (the opening pick, the Coda choice) both drop the dock and let the
page own its one action. With no dock and no second button there is no
interaction that could lose the image. (3) Following the opening pick's
division, the page owns the action and the panel became a summary: the
StashReturnNotice panel keeps the card face and its hint but no longer holds the
button. (4) Still click-only — no Enter binding is added for this phase, so a
fast double-press can't blow through the re-encounter (the rule #51/#88 set).
(5) The image is displayed contained, not cropped square like a pick thumb —
there is nothing to compare, so it is shown whole; new `.stash-preview-fit` /
`.stash-preview` rules reuse `.grid-picker`'s page chrome. (6) Copy moved into
`cardHints.stashReturn` (previewTitle / previewHint / previewFoot / confirm),
matching how the stamp page keeps its own page copy; `deckPanel
.stashReturnNoticeButton` is gone and the panel hint now points at the page.
Files: frontend/src/editor/Editor.jsx, frontend/src/editor/DeckPanel.jsx,
frontend/src/editor/cards/stashReturn.jsx, frontend/src/editor/editor.css,
frontend/src/copy/uiText.json.

## [08] #92 — Closer and Deeper enter through a "Zoom In" button; drawing from the deck skips (2026-07-26)
What: Added a generic `entryGate` field to the card registry shape and hung
Closer and Deeper on it. A gated card deals into a resting state — no begin
hook, no Overlay, no card hotkeys — with its entry button ("Zoom In") pinned at
the foot of the description panel just above the deck dock. Drawing from the
deck before entry is a skip: no commit hook, no universal bake, no state
capture, next card. Pressing Zoom In runs the existing frame session unchanged.
Where: PR #95.
Choices: (1) The pre-entry resting state shows the committed piece untouched —
no frame rect, nothing added — matching the other resting states (AwaitingDeal,
the beat after a Coda is set aside); begin simply never runs, so this needed no
code of its own. (2) Gate state is held as the entered CARD OBJECT
(`enteredCard`), not a boolean, so it resets itself when the next card turns
over — the reducer hands out a distinct object per deal, which is why the begin
effect already keys on it. (3) The entry button uses the existing
`.deck-panel button.primary` style and sits between `.panel-scroll` and the
dock, the same slot the Coda's accept button uses — no new CSS. (4) The skip
still dispatches COMMIT, so a skipped card is recorded as spent in the deck
overlay, like Delay and Searcher which also commit nothing. (5) Enter stays
bound to the deck click pre-entry (it is the skip); only session-facing
bindings — card accents, brush/arrange grammars, card undo/redo — wait for the
gate, via a new `cardLive` flag. (6) Tools receive a generic `entered` prop
(always true for an ungated card) so each card's own copy can speak to its
resting state: the pair now shows a shared `cardEntry.restingNote` instead of
their commitNote until entry. (7) Copy: `cardEntry.zoomIn` / `restingNote` plus
`deckPanel.deckHintGate` / `deckDrawGate`, all in uiText.json. (8) Noted in
foundryRegistry.jsx that `entryGate` is not carried over — no card in the
Foundry roster declares one, and FoundryPanel would need the same generic
treatment first.
Files: frontend/src/editor/Editor.jsx, frontend/src/editor/DeckPanel.jsx,
frontend/src/editor/cards/registry.jsx,
frontend/src/editor/cards/frameCardFactory.jsx,
frontend/src/editor/cards/closer.jsx, frontend/src/editor/cards/deeper.jsx,
frontend/src/copy/uiText.json, frontend/src/foundry/foundryRegistry.jsx.

## [07] #91 — Flip the dock: deck on the left, drawn card on the right (2026-07-26)
What: Swapped the two dock columns so the deck sits on the left and the card
drawn from it lies face-up on the right. The stack's two under-cards now splay
down-LEFT instead of down-right, and the deal flip enters from the left (the
deck's new side) so the card still reads as coming off the deck it was dealt from.
Where: main.
Choices: mirrored the splay offsets exactly — translate(3px,4px)/(6px,8px)
became (-3px,4px)/(-6px,8px); the downward component is unchanged, only the
horizontal sign flipped, so the stack still opens away from the dealt card.
Same for the flip: `translateX(48%)` → `translateX(-48%)`, same magnitude,
duration and easing untouched (#59's to tune). No copy changed — nothing in
uiText.json names a side. The swap is pure JSX order + CSS sign; `.deck-pair`
keeps its two equal fixed columns, so the deck still lands in one spot every
round, and the 6px leftward overhang clears the panel's 24px padding.
Files: frontend/src/editor/DeckPanel.jsx, frontend/src/editor/editor.css.

## [06] #88 — Stash Return is a card — shuffled in, not scheduled (2026-07-26)
What: The stash no longer comes back on a schedule. When Act I ends, COMMIT
slips one **Stash Return** card into the undealt deck at a uniformly random
position (`shuffleIn` in `deck.js`); drawing it opens the existing stash beat
from #51 — the click-only notice, then the live placement session Editor
already runs for `STASH_RETURN`. It shows in REMAINS like any other card
(only the Coda hides), so *that* it is coming is known and *when* is not. If
the Coda surfaces first the stash is simply lost: the session completes and
exports without it, no orphaned state. Reducer behavior was checked with a
throwaway esbuild+node harness (21 assertions: shuffle-in position spread,
the notice path, Coda-first, no-stash sessions, Skim's kept top).
Where: PR #90
Choices: (1) **The deal decides the phase, like the Coda's.** DEAL on a
`kind: 'stash'` card lands straight on `STASH_RETURN_NOTICE` with the card as
`currentCard`, instead of the card taking a WORKING round of its own. Giving
it a round would have said the same thing twice (card panel, then notice) and
cost an extra press; more importantly the notice phase is where Enter is
*unbound*, which is #51's protection against a fast double-press committing
the stash unseen. The notice now shows the card face (with CardZoom), so the
card is genuinely drawn and seen. Consequence: the card never increments
`roundsDealt` and never bakes — the acts keep their old pacing.
(2) **A distinct `kind: 'stash'`**, not a mod with a family. Mods are
tutorable, buildable in the deck editor, and countable as rounds; this card
is none of those. `STASH_RETURN_CARD` sits beside `DEATH_CARD` and is
deliberately not in `MOD_CARDS`, so the deck editor never offers it.
(3) **Visible in REMAINS, not takeable by Searcher.** `remainingCounts` now
filters only the Coda; a new sibling selector `findableCounts` (mods only)
feeds Searcher's picker through `deckView.findable`. Otherwise Searcher would
show a card the reducer refuses — and buying the stash's timing is #18's
parked mechanic, not a side effect of the tutor.
(4) **The registry entry is declarative.** `stashReturn` is registered (every
dealable card belongs there) with `skipBake` and no lifecycle hooks, because
its beat is a phase; the card's panel lives in `cards/stashReturn.jsx`, which
DeckPanel renders for the existing `STASH_RETURN_NOTICE` case — no new
per-card branch. The placement it opens is the shared session, untouched.
(5) `shuffleIn(deck, card, keepTop)` keeps Skim's promise (a kept top card
stays on top), and the death shuffle's empty-deck trigger now reads the deck
*before* the insert, so a lone Stash Return card can't silence it and strand
a session with nothing to draw.
(6) Card face: a **placeholder** cast from plate `03` with the name, type
line and description typed into that plate's own slots, art window left as an
empty field; pngquant'd in place (741K → 242K, no banding). **Stew casts the
real face in the Foundry** — the id `stashReturn` is the permanent key, so
replacing `assets/cards/stashReturn.png` is the whole job.
(7) `stashReturned` stays (the record that the stash actually came home);
`stashShuffled` is the new guard that the card has joined the deck.
(8) **Castable in the Foundry** (added 2026-07-26, Stew): the placeholder in
(6) is only replaceable if the face can be commissioned, so `stashReturn`
joins `COMMISSIONS` alongside the Coda. Two values it lacked, both Stew's
call: the type line reads **stash** (its own family — `Card.jsx`'s text face
already calls it "the stash"), and the mark is the **singular** diamond punch,
the Coda's class, on the grounds that both exist at most once and are beats in
the session's structure rather than modifications you can stack. Family is
assigned in `foundryDeck.js` rather than on the `deck.js` descriptor, mirroring
the Coda — family is a Foundry concern (it prints as the type line), and Deck's
own `cardFamily` image/deck split would misread it. The name and description
needed nothing: `uiText.json` already carried them and `typeLayer.js` pulls the
description by commission id.
Files: frontend/src/editor/deck.js · frontend/src/editor/cards/stashReturn.jsx
(new) · frontend/src/editor/cards/registry.jsx · frontend/src/editor/DeckPanel.jsx
· frontend/src/editor/Editor.jsx · frontend/src/editor/cards/searcher.jsx ·
frontend/src/editor/Card.jsx · frontend/src/copy/uiText.json ·
frontend/src/assets/cards/stashReturn.png (new) · CLAUDE.md ·
frontend/src/foundry/foundryDeck.js · frontend/src/foundry/rarity.js ·
frontend/src/foundry/FoundryEditor.jsx · card_maker.md

## [05] #87 — The deck is the button — one click commits and deals, with a flip (2026-07-26)
What: Retired the two-press rhythm. A deck of card backs now sits in a dock
pinned at the foot of the right panel, with the drawn card face-up beside it
(face left, deck right) and that card's Tools above the pair; one click on the
deck runs the existing commit semantics (card hook → universal bake, viewport
reset + `renderAll()` flush untouched in `masterRaster.bake`) and immediately
deals, the new card flipping over out of the deck. Everything that advances a
session goes through one `handleAdvance` in Editor — opening placement, the
stash return, and every card round — and Enter is that same action from the
keyboard. No End or Deal buttons remain; the Coda keeps its own finish/export
flow, and the stash-return notice keeps its click-only acknowledgement.
Where: PR #89
Choices: (1) `handleCommit` split into `commitCurrentCard` (impure work) +
the caller's `dispatch(COMMIT)`, so COMMIT and DEAL are dispatched adjacently
and land in ONE render — otherwise a slow commit hook (Deeper's restore) lets
React paint the empty in-between state. (2) The flip is a real two-sided turn:
back and face share one box inside `.deal-flip-inner`, which rotates 180° and
slides in from the deck's side; both sides still render through `Card.jsx`, so
nothing new hardcodes card geometry. 560ms, `cubic-bezier(.45,.05,.25,1)` —
eased so the back reads for the first ~45% (#59 tunes it). (3) The flip is
remounted by a `dealKey` of `roundsDealt:id:variant` — a card always arrives
right after a commit or by being searched out, so that pair is unique per
card turned; without a key React reuses the element and the animation never
replays. (4) `grid-template-columns: minmax(0,1fr)` on the pair — a bare 1fr
lets a card's 745px intrinsic art width blow one column out. (5) Copy: the
deck's standing instruction is "Draw from the deck when this round is done: it
bakes in for good, and the next card turns over" (hover/aria: "Commit this
round and draw"); every card hint that said "End the round" now says "Draw to
end the round"; the guide and Keys overlay follow. (6) Delay's held-right
indicator moved into the dock — it used to live on the deal panel, which is
now a rare beat. (7) The deck's remaining count moved into the dock too, so
it is visible every round (set-knowledge, which the legibility rule allows).
Files: frontend/src/editor/DeckPanel.jsx · frontend/src/editor/Editor.jsx ·
frontend/src/editor/editor.css · frontend/src/copy/uiText.json · CLAUDE.md ·
hotkeys.md

## [04] #86 — Card back — the ZYME logo on a plain field (2026-07-26)
What: Added a `faceDown` prop to `Card.jsx` — the back is the existing ZYME
wordmark centered on one flat field, nothing else, rendered through the same
745×1040 frame as every face. Placed a face-down card in the awaiting-deal
panel so it is reachable in the running app.
Where: main
Choices: (1) JSX/CSS inside `Card.jsx`, not a shipped PNG — the card already
renders its own text face this way, and `/logo/zyme.png` is already tracked
in `frontend/public`, so no new image enters the repo. (2) Field colour =
`var(--surface)` (#1a1a1a): a plain grey, distinct from the app background
`--bg` (#252527), and the one palette value this wordmark is already known
to read against (header, Setup) — the mark is dark-on-transparent, so a
lighter field like `--fill` would erase it. (3) The back's `<img>` is
decorative (`alt=""`): the frame already says "a card, face down".
(4) `faceDown` suppresses the family tint and the Coda border so the back is
one back, never a tell. (5) Interim placement in `AwaitingDeal` above the
deck counts, commented as such — issue #87 gives the deck its own clickable
home in that panel and supersedes it.
Files: frontend/src/editor/Card.jsx · frontend/src/editor/editor.css ·
frontend/src/editor/DeckPanel.jsx
