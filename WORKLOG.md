# WORKLOG

Compact history of completed issues, newest entries first. Each entry:

```
## [NN] #<issue> — <title> (<date>)
What: 1–2 lines on what was done.
Where: main / PR #N (merged) / spawned #N, #N / closed-no-action.
Choices: any decisions the executor made on its own.
Files: the main files touched.
```

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
