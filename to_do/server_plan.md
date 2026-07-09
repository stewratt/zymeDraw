# server plan — the vat: a portable engine and its switchboard

> Written 2026-07-08. This is the founding document for the **other half
> of the ZYME toolchain**: the always-on ComfyUI recursion server and the
> front end that lets people tend it in real time. `app_plan.md` §4 drew
> the boundary from the draw app's side — *"the complementary refinement
> app for the server's stream is a different project; the shared surface
> is only the folder convention."* This doc is that different project.
> Nothing here is committed to build; §8 sequences it, §9 holds the
> questions Stew still owes answers on.
>
> Working name for the server application: **the vat** (register
> discussion in §6; every name in this doc is a proposal until Stew
> keeps it).

---

## 0. What exists, and why a v2

A ComfyUI recursive image generation server already runs 24/7 in the
studio. It was built to be headless and low-maintenance: it produces
continuously, serves a gallery page over Tailscale, and shares its
folders over Samba to Windows machines. It works — but its architecture
is **highly specific to the one machine it was built on**. Paths, service
wiring, and process management are hand-fitted; it cannot be picked up
and dropped onto another GPU box.

v2's charter: **any machine with a GPU can become the server for any
number of machines running the draw system.** Everything else in this
doc — the switchboard, ingestion, curation, the live event — sits on top
of that portability, so portability is the first wave, not a refactor
for later.

---

## 1. The contract — one folder, readable in real time

Strip everything away and the server owes the world exactly one thing:

> **An output folder that grows, readable in real time by any machine on
> the local network that can reach its file path.**

That folder is the entire coupling surface with ZYME (the draw app).
Draw clients mount it (Samba/NFS/syncthing) or run against it locally;
`app_plan.md` §4 already covers the client side (the backend re-reads the
input folder per request, so a growing folder feeds fresh grids with
zero draw-app code). Nothing in this project may assume anything about
the draw app beyond "images appear in a folder," and nothing in the draw
app may couple to this project beyond the same.

A useful corollary: **curation is folder editing.** "Build the best
version of the output folder" is literally the job — what's in the
folder is what every draw session on the network gets dealt from. The
curation surface (§3.3) is a supervised interface to adding and removing
files from that one folder.

---

## 2. The core loop, and its variable surface

The engine, stated plainly (this is the whole machine — everything else
is tending):

1. **Four input folders** feed four IPAdapter inputs in one ComfyUI
   workflow.
2. Each **turn** (cycle), the orchestrator picks **one random image per
   folder**, submits the workflow, and collects **one output** into the
   output folder.
3. The output is **also copied back into one of the input folders** —
   the recursion. The stream feeds itself.
4. Go to 1, forever.

The recursion-receiving folder is the load-bearing one: it's the reason
the stream has a *lineage* rather than being four static moodboards
shuffled. In fermentation terms it is **the mother** — the part of the
culture that carries forward (§6 for the register).

**The variable surface** — everything along the chain a person might
tune per-turn, which is exactly what the switchboard exposes:

- **Text prompt tables** — pools of prompts the workflow draws from;
  add/remove/reweight lines live.
- **Sampler values** — steps, CFG, denoise, sampler/scheduler choice.
- **IPAdapter weights** — per-input influence; effectively a 4-channel
  mixer over the folders.
- **Scrapers on/off** — the automated feeds that drip found images into
  input folders; each is a toggle.
- **Recursion routing** — which input folder receives the output copy
  (and possibly a probability split).
- **Pacing** — turn cadence, batch size if any.

Design rule carried over from the studio machine's lessons: **the engine
never restarts to take a new value.** Settings are hot — the
orchestrator re-reads its session config at the top of every turn, so a
slider moved mid-generation applies to the *next* turn, cleanly. (This
mirrors the draw app's End-then-Deal rhythm: changes commit at turn
boundaries, never mid-image.)

---

## 3. The front end — three surfaces, two kinds of people

The insight from running the studio server: there are **many hands but
one throttle**. The front end is three surfaces with different access:

### 3.1 The switchboard (one seat)

The control room, used **at the server machine with mouse and
keyboard** — the seat the operator physically sits down at. It is
everything §2 lists as tunable, presented as a live mixing desk:
prompt-table editor, sampler sliders, the 4-channel IPAdapter mixer,
scraper toggles, recursion routing, pacing. Plus the operator's inbox:
the approval queues from the other two surfaces.

**One seat is a rule, not a limitation.** Exactly one person is the
operator at a time; the seat can be handed off but never shared. Two
people fighting over CFG mid-stream is how a ferment dies. (Whether the
seat is enforced by software — a session lock the UI shows — or just by
the one physical chair is an open question, §9. Start with the chair.)

### 3.2 The intake portal (everyone, from anywhere)

Anyone on the network, from any device, can **feed the vat**: submit
their own images through a simple upload page. The portal does the
formatting work so the workflow never sees a malformed input — every
submission is normalized to a **uniform 1024×1024 square crop** (with a
simple crop-position choice at upload, since a center-crop default will
guillotine somebody's composition). Formatted submissions land in a
**staging folder** with a note of who sent them and where they'd like
them routed; the operator approves each one into an input folder of
their choice, or declines it. Nothing enters the engine's diet
unsupervised.

### 3.3 The curation stream (everyone, from anywhere)

Anyone can watch the output folder as a live stream — newest first,
updating in real time — and flag images two ways:

- **Keep** — mark it as good: protect it, surface it in the gallery,
  make it part of the folder's face. (Stew's word for this is still
  owed — §9.)
- **Pull** — request its removal from the output folder.

For everyone except the operator these are **requests**, queued to the
switchboard. The operator approves or denies; an approved pull moves the
image to the **sediment** — a holding folder outside the tap, never a
delete. (The draw app's destructive-commitment philosophy is right for a
personal canvas; a shared folder that many sessions depend on gets a
recoverable remove. Sediment can be emptied deliberately, by a person,
later.)

The three surfaces compose into the operator's actual job description:
**build the best version of the output folder** — tune what the engine
makes, control what it eats, and referee what stays in the tap.

---

## 4. Roles at a live session

The live experience is many stations around one stream. At any moment a
person at the event is doing one (or drifting between several) of:

1. **Operating the switchboard** — the one seat (§3.1). If nobody's in
   it, anyone may sit down; the seat makes the role, not the person.
2. **Feeding** — submitting their own images through the intake portal
   (§3.2), from a phone or any laptop.
3. **Curating** — watching the stream, flagging keeps and pulls (§3.3).
4. **Drawing** — running a ZYME draw session on a machine pointed at the
   output folder. The main consumers of everyone else's work.
5. **Casting** — making card faces in Foundry, on its own clock.
6. **Working the print annex** — the physical media station: printed
   draw-app outputs, hand collage, paint, whatever — and a **scanner**
   that feeds the results *back through the intake portal*. This closes
   the largest loop in the whole system: pixels → paper → hands → glass
   → pixels → the vat's diet.

Note what the diagram looks like: every role either feeds the folder,
tends the folder, or draws from the folder. The output folder is the
campfire; the event is arranged around it.

---

## 5. The live event — first day at Zyme Research Labs

The event is structured as a hackathon-length **first day on the job**.
Not a party with software in it — an office where the work is real and
the fiction is a thin, deadpan coat of paint over jobs that genuinely
need doing.

**The fiction (proposal).** Zyme Research Labs maintains a **living
culture** — a recursive image ferment, started from a founding batch,
that has never been allowed to stop. The lab's charter is simple: the
culture must be fed, tended, and drawn from continuously; unattended, it
drifts; over-handled, it sours. Today is your first day. You will be
issued a badge, walked past the vat, and assigned to a department —
though the lab is understaffed and everyone ends up covering several.

**The rule that keeps it from becoming a game:** every fictional job is
a real job. Nobody pretends. Intake paperwork *is* the upload form; the
process-control room *is* the switchboard; quality control *is*
curation. The fiction never asks for behavior the tool doesn't need —
it only names, with a straight face, what people are actually doing.
This is the CLAUDE.md §1 tone invariant applied to an event: deadpan
institutional register, not arcade register. Onboarding language, duty
rosters, and signage — never points, teams, or winning.

**Departments** (each is one of §4's roles wearing a name tag):

- **Process Control** — the switchboard seat. The role is the *duty
  operator* (the doc's "servermaster" stays a design-conversation term,
  like "death card" — it smells of dungeons, not darkrooms).
- **Intake** — submissions and specimen preparation (the 1024 crop).
- **The Cellar** — quality control on the stream: keeps and pulls.
- **Composition** — the draw-app stations.
- **The Foundry** — already named; card casting.
- **Reprographics** — the print annex: printer, scanner, blades, glue.

**Badges are Foundry work.** Employee badges are cast as real 745×1040
cards — name, department, first-day date — using the card maker that
already exists. The onboarding table is a Foundry station; your badge is
the first thing you make, and making it teaches you the card tool. The
fiction and the toolchain shake hands here, and it costs zero new code.

**The vat is physically present.** The server machine should be visible
— a monitor showing the switchboard or the raw stream, not a box in a
closet. People should be able to walk over and watch it think. The one
chair in front of it *is* the one-seat rule.

---

## 6. Register — the fermentation vocabulary

The draw app's card names already live in a process register — and,
notably, several (**Skim**, **Cull**, the retired **Rack**) are literal
fermentation/cellar operations. The server extends the same register in
its own direction. Proposed vocabulary, to be kept or struck by Stew:

| thing | name | why |
|---|---|---|
| the server application | **the vat** | the vessel the culture lives in |
| the recursion-receiving input folder | **the mother** | the part of the culture carried forward |
| one generation cycle | a **turn** (of the ferment) | already the natural word |
| the output folder as consumed by draw apps | **the tap** | v5 §4 already calls ZYME "a tap on a stream" |
| submitting images | **feeding** | what you do to a culture |
| removal holding folder | **the sediment** | settles out, isn't destroyed |
| the switchboard seat | **duty operator** | institutional, not martial |

Same guardrails as the card register: one concrete process word,
nothing cute, nothing gamer. If a name needs explaining at the event,
it's wrong — "the tap" should be understandable from watching someone
use it once.

---

## 7. Architecture scaffolding

### 7.1 Three layers

**Layer 1 — the engine.** ComfyUI running headless (`--listen`, API
mode) plus a small **orchestrator**: the loop that picks one random
image per input folder, injects them and the current settings into a
stored API-format workflow JSON, submits it, collects the output, and
copies it to the mother. The orchestrator is deliberately dumb — a
`while True` with good logging. All creativity lives in the workflow
JSON and the session config, both of which are files a person can read.

**Layer 2 — the state.** One **`session.json`** (or equivalent) holding
every §2 variable, re-read by the orchestrator at the top of each turn —
the hot-settings rule. One **folder layout convention** the app creates
and owns:

```
vat/
├── inputs/1..4/        # the four IPAdapter diets (one is the mother)
├── output/             # THE folder — the tap
├── staging/            # intake submissions awaiting approval
├── sediment/           # pulled outputs, never deleted
└── session.json        # the live settings the switchboard edits
```

Queues (intake approvals, pull requests) should stay as close to
files-plus-a-ledger as possible — this project inherits the draw app's
instinct that state you can `ls` is state you can trust. Whether the
ledger is a JSON file or SQLite is a §9 question; start with JSON.

**Layer 3 — the web front end.** One web app served by the server over
LAN/Tailscale: the switchboard view (the seat), the intake portal, the
curation stream, and the plain gallery the current server already has.
Real-time via **SSE** — a folder watcher pushes new-output events to
every open stream view (the same chokidar→SSE shape v5 §4 sketches for
the draw app; build it once here, where it's core rather than optional).

### 7.2 Tech shape (options, recommendation first)

- **Option A — one Python process (recommended).** FastAPI serves the
  web app *and* hosts the orchestrator loop. One language, one process,
  one systemd unit; the orchestrator and the API share session state
  natively, and ComfyUI's ecosystem is Python-shaped. Front end is
  Vite + React built to static files — same skills as the draw app,
  and the eventual design language (v5 §5) can cover both.
- **Option B — Node web layer + Python orchestrator.** Mirrors
  zymeDraw's Express-plus-sidecar pattern and Stew's Node comfort. Two
  processes and an IPC seam for what is naturally one program; the seam
  buys familiarity but costs the thing v2 exists for (fewer moving
  parts on a strange machine).

Either way: **the engine must run without the front end.** The web app
is tending, not life support — kill the browser, the vat keeps
fermenting. This is the server-side twin of the draw app's
graceful-degradation invariant.

### 7.3 Portability rules (the reason v2 exists)

- **No hardcoded paths, ever** — the `~/.deck-config.json` lesson,
  applied from day one. First run on a new machine is a short setup:
  point at ComfyUI, choose the vat folder, done.
- **The folder layout is created by the app**, not assumed. `vat/` can
  live anywhere the machine has disk.
- Tailscale, Samba, NFS stay **OS-level concerns** — the app binds to
  the LAN and serves HTTP; how machines reach it is not its business.
  Document the recipes (README per platform), don't code them.
- GPU assumptions live in the workflow JSON, not the orchestrator —
  swapping a workflow for a smaller card is a file swap.

### 7.4 What this project is not

- Not part of the zymeDraw codebase — a **sibling repo**. This doc
  lives here because it's where the thinking lives; the code shouldn't
  (§9 confirms). The shared surface stays: images appear in a folder.
- Not a cloud service. Local network, one studio, physically present
  machine. Tailscale extends the room; it doesn't change the model.
- Not an account system. Names on intake submissions are a text field,
  not a login. The event is a room of people who can see each other.

---

## 8. Waves (proposed sequence, checkpoint map)

- **Wave 0 — the portable engine.** Orchestrator + workflow JSON +
  folder layout + hot `session.json`. Headless, no UI; prove it by
  deploying on a second GPU machine and letting it run overnight.
  This alone retires the old server's machine-specificity.
- **Wave 1 — the switchboard.** The web UI over `session.json` + live
  turn status. One seat, at the machine. The operator can finally tune
  without SSH.
- **Wave 2 — the tap and the cellar.** SSE stream view, keep/pull
  requests, the operator's approval queue, the sediment. Curation
  becomes real.
- **Wave 3 — intake.** Upload portal, the 1024 square crop with crop
  choice, staging → approval → routing into input folders.
- **Wave 4 — the event dressing.** Department naming through the UI
  copy, onboarding/badge flow (the Foundry cross-link), gallery
  polish, signage. Cheap by design — it's copy and print work over
  surfaces that already exist.

Parallel at all times: the draw app keeps consuming the folder with
zero coupling. The first full-dress live event needs Waves 0–3; Wave 4
is what makes it *Zyme Research Labs* instead of a LAN party.

---

## 9. Open questions for Stew (answer before each wave opens)

1. **Repo:** sibling repo confirmed? And its name — is the application
   itself "the vat," or does that stay the vessel's name inside a
   differently-named app?
2. **Tech shape (Wave 0):** Option A (one FastAPI process,
   recommended) or Option B (Node + Python, familiar seam)?
3. **The keep verb (Wave 2):** what does "keep" concretely do —
   protect-from-pull + gallery feature, or also copy into a separate
   curated best-of folder? And is "keep" the word?
4. **Pull approval symmetry (Wave 2):** the doc assumes *all*
   non-operator pulls need approval. Should keeps need approval too, or
   are keeps free (they only add, never remove)?
5. **The seat (Wave 1):** software-enforced lock, or the physical
   chair? If software: how does a handoff work when the operator walks
   away without releasing it?
6. **Intake routing (Wave 3):** does the submitter suggest a target
   input folder, or is routing purely the operator's call?
7. **The fiction's temperature (Wave 4):** how thick is the coat of
   paint — badges and department names only, or also artifacts like an
   employee handbook, intake forms, a lab logbook the operator keeps?
8. **Old server migration:** does the studio machine get wiped onto v2
   at Wave 0, or run both until v2 has earned trust?
