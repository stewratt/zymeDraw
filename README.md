# Deck

A card-constrained, destructive image editor. The workflow is driven by drawing
cards from a deck — each card constrains the UI to exactly one tool, the user
performs that action on a canvas, then commits it permanently before drawing
the next card.

## Requirements

- **Node 20 or newer** (we use `node --watch` for backend reload, built in
  since Node 18, but 20+ is a safer floor).

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

This starts two processes side by side in one terminal:

- **frontend** (Vite dev server) at <http://localhost:5173>
- **backend**  (Express) at <http://localhost:5174>

Open <http://localhost:5173> in your browser. If the page shows
"Backend: connected", both servers are running and talking to each other.

## Architecture, in one sentence

The frontend is the brain (React UI, Fabric.js canvas, deck state machine);
the backend is the hands (reads/writes the local filesystem). They talk over
plain REST on localhost.

## Per-platform notes

The same commands work on Linux, Mac, and Windows. On Windows use `cmd` or
PowerShell; on Mac/Linux use any terminal.
