# WORKLOG

Compact history of completed issues, newest entries first. Each entry:

```
## [NN] #<issue> — <title> (<date>)
What: 1–2 lines on what was done.
Where: main / PR #N (merged) / spawned #N, #N / closed-no-action.
Choices: any decisions the executor made on its own.
Files: the main files touched.
```

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
