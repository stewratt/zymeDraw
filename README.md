# ZYME

A card-constrained, destructive image editor. The workflow is driven by drawing
cards from a deck — each card constrains the UI to exactly one tool, the user
performs that action on a canvas, then commits it permanently before drawing
the next card.

## Get ZYME (start here)

Most people should just download the app — no Node, no Python, no terminal:

**[Download the latest release →](https://github.com/stewratt/zymeDraw/releases)**

Pick your file:

- **Linux** — the `.AppImage`. Make it executable (right-click → Properties →
  allow executing, or `chmod +x`), then run it. If it complains about FUSE,
  run it as `./ZYME-*.AppImage --appimage-extract-and-run`.
- **Windows** — the `Setup-*.exe`. SmartScreen warns because the build is
  unsigned: choose *More info → Run anyway*.
- **Mac** — the `-arm64.dmg` on Apple silicon (2020+), the plain `.dmg` on
  Intel. Unsigned build: first launch is right-click → Open, then Open again.

On first run the app offers to fit its **machine tools** — the models behind
the cutout and detail-restore cards. It's a one-time download of about
400 MB (just under 1 GB once installed, kept in the app's own data folder,
removed with the app). You can let it finish in the background, and if you
decline or it fails, everything else works exactly the same — those two
cards simply degrade. Setup keeps an entry to install them later.

Then Setup asks for two folders — one of source images to draw from, one
for finished exports. That's the whole install.

The source folder can also be a **URL** — paste something like
`http://100.95.12.41:9000/favorites/` and ZYME reads the images off that
server instead of your disk, with no drive to mount. Any server that lists
its files works (Python's `http.server`, nginx, Apache, Caddy); a folder can
make itself explicit by publishing an `index.json` beside the images. The
export folder is always a folder on your own machine.

Everything below is for **developing ZYME from the repo**.

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

## Build & package

- `npm run build && npm start` — production web mode: the compiled frontend
  and the API served by Express alone on <http://localhost:5174>.
- `npm run electron` — the desktop shell: Express in-process on a free
  port, ZYME in its own window. Build first if the frontend changed.
- `npm run dist` — casts this machine's installer into `dist/`.
- Pushing a tag like `v0.2.0` makes GitHub Actions build **all three
  platforms'** installers and attach them to a draft release for review.

## Architecture, in one sentence

The frontend is the brain (React UI, Fabric.js canvas, deck state machine);
the backend is the hands (reads/writes the local filesystem). They talk over
plain REST on localhost.

## Per-platform notes

The same commands work on Linux, Mac, and Windows. On Windows use `cmd` or
PowerShell; on Mac/Linux use any terminal.
