# Debug Loop — design (Deck / zymeDraw)

> Plain-language explanation of the automated debug loop you launched with
> `/loop`. Read this top-to-bottom; it tells you exactly what the loop does
> each cycle, where it writes its findings, and how it decides to stop.

---

## What a "loop" is here

`/loop` runs the **same instruction over and over**, self-paced (no clock —
each cycle finishes before the next begins). The loop has no memory of its own
between cycles, so **everything it learns is written to files on disk.** Each
new cycle starts by re-reading those files to know where it left off. That is
the whole trick: the *files are the memory*.

Two files hold the state:

| File | Role |
|---|---|
| `debug_loop_findings.md` | The **ledger** — every bug found, its status, evidence, and the fix applied. This is your read-out. |
| `debug_loop_screenshots/` | Before/after PNGs the loop captured from the live UI as proof. |

---

## The cycle (classic detect → fix → verify → log)

Each cycle does **one bug end-to-end**, in six stages:

1. **Health check.** Make sure both dev servers are up (`npm run dev`:
   frontend `:5173`, backend `:5174`). If not, start them and wait until the
   app responds. Confirm the editor actually loads past the Setup screen
   (your config already points at a folder with 4,430 images, so it should).

2. **Detect.** Drive the real browser with the `gstack browse` tool against
   `http://localhost:5173`. Walk the **coverage map** (below) one area at a
   time, taking screenshots and reading the browser console. A "bug" is any
   of: a JS console error, a thrown exception, a visibly broken/invisible/
   mis-placed UI element, a card that doesn't do what its tool claims, or a
   crash.

3. **Triage.** Compare what it found against the ledger. Skip anything
   already logged. Pick the **single highest-severity new bug**
   (crash > console error > broken behavior > visual glitch > cosmetic).

4. **Fix.** Spawn a sub-agent that root-causes that one bug (real root cause,
   not a band-aid) and edits the source. It must honor the project rules in
   `CLAUDE.md` — no per-card branches in `Editor.jsx`/`DeckPanel.jsx`,
   `deck.js` stays pure, Fabric 6.x APIs verified, committed objects tagged.

5. **Verify.** Re-run that exact UI flow in the browser. Screenshot
   before/after. Confirm the bug is gone **and** nothing nearby regressed.
   If the fix didn't work, mark it `OPEN` again with notes and move on (a
   later cycle can retry) — never log a fix as done without visual proof.

6. **Log.** Append/Update the bug's entry in `debug_loop_findings.md` with
   status, severity, screenshot paths, root cause, and the files changed.

---

## Coverage map (what gets swept, once each)

The loop tracks which areas it has already swept so a full run touches each
once:

- **Setup screen** — bad/empty paths, error display, Continue gating.
- **Load → editor transition.**
- **Deck panel** — Draw card, card-flip animation, tool area, SESSION COMPLETE.
- **Add cards** — Add 1 / 2 / 3: placement, move/scale/rotate, End locks.
- **Midgame cards** — Pencil, Eraser, Flatten, HSV, Blur, Grain, Grade.
- **Endgame cards** — Vignette, Frame, Final Grade, Grain Finish.
- **Layers panel** — slot mode and target mode, `layerKinds` filtering.
- **Keyboard shortcuts** — Space / Enter / R, and suppression inside inputs.
- **Export** — `POST /api/export` writes a PNG; "Open output folder" button.

---

## What the loop will and won't do

- **Auto-fixes bugs but does _not_ commit.** All changes are left in the
  working tree, uncommitted, so you can review every diff yourself and keep
  or discard. (Your choice at launch.)
- **One full sweep, then it stops.** When it has swept every coverage area
  and there are no remaining `OPEN` bugs, it writes a final summary at the
  bottom of the ledger and ends the loop. It does not run forever.
- **Never weakens the game.** The "destructive, no global undo" mechanic and
  the architecture invariants in `CLAUDE.md` are treated as correct-by-design,
  not bugs. The loop fixes *defects*, it doesn't redesign the product.

---

## How to follow along / take over

- Watch `debug_loop_findings.md` grow — that's the live report.
- Browse `debug_loop_screenshots/` for visual proof of each fix.
- To stop early: interrupt the loop in Claude Code.
- When it finishes, review the uncommitted diff (`git diff`) and decide what
  to keep before committing anything yourself.
