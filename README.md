# Deck

A card-constrained, destructive image editor. The workflow is driven by drawing
cards from a deck — each card constrains the UI to exactly one tool, the user
performs that action on a canvas, then commits it permanently before drawing
the next card.

## Requirements

- **Node 20 or newer** (we use `node --watch` for backend reload, built in
  since Node 18, but 20+ is a safer floor).
- **Python 3.10 or newer** — only for the optional ML sidecar (Stamp
  cutouts, Deeper detail restore). The app runs fine without it.

## Install (once per clone)

From the repo root:

```
npm run install:all
```

This installs dependencies in three places: the root (just `concurrently`),
`frontend/` (React + Vite + Fabric.js), and `backend/` (Express).

## Run (every dev session)

From the repo root:

```
npm run dev
```

This starts three processes side by side in one terminal:

- **frontend** (Vite dev server) at <http://localhost:5173>
- **backend**  (Express) at <http://localhost:5174>
- **ml** (Python sidecar) at <http://localhost:5175> — only if it has been
  set up on this machine (below); otherwise it prints a note and stays off.

Open <http://localhost:5173> in your browser. If the page shows
"Backend: connected", both servers are running and talking to each other.

## The ML sidecar (once per machine, optional)

Two cards use local ML models: **Stamp** (background-removal cutouts via
rembg) and **Deeper** (Real-ESRGAN detail restore). They live in a small
Python service that `npm run dev` auto-starts when its environment exists.
Without it those cards degrade gracefully — the session never blocks.

Set it up once per machine, from the repo root:

**Mac / Linux**

```
cd backend/ml
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

**Windows** (cmd or PowerShell)

```
cd backend\ml
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

That's it — the next `npm run dev` starts the sidecar automatically.
Check it's alive at <http://localhost:5174/api/ml/health>.

Notes:

- Everything runs **CPU-only**; no GPU or CUDA setup needed. An upscale of
  a working-canvas-sized image takes a few seconds.
- The Real-ESRGAN weights ship with the repo
  (`backend/ml/models/realesr-general-x4v3.onnx`, ~5 MB, converted from the
  official release — provenance in `backend/ml/tools/`).
- rembg downloads its u2net weights (~170 MB) to `~/.u2net` on the first
  cutout, so the first Stamp on a fresh machine is slow. Once.
- The venv lives at `backend/ml/.venv` on every machine (gitignored,
  repo-relative — no hardcoded paths anywhere).

## Architecture, in one sentence

The frontend is the brain (React UI, Fabric.js canvas, deck state machine);
the backend is the hands (reads/writes the local filesystem). They talk over
plain REST on localhost.

## Per-platform notes

The same commands work on Linux, Mac, and Windows. On Windows use `cmd` or
PowerShell; on Mac/Linux use any terminal.
