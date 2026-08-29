# Deck in the pocket — the mobile plan

> The **mobile line**: a lightweight, browser-based collage tool for the
> phone — the same session arc, the same commitment mechanic, a trimmed
> deck, no Foundry, no ML. Written 2026-08-29 from a full dissection of
> the desktop app; **nothing here is committed to build** — this is the
> feasibility study and the checkpoint map, per Stew's ask: "a detailed
> plan before committing to building anything."
>
> Companion to CLAUDE.md (read that first) and a sibling of
> `app_plan.md` / `cards_plan.md`. §7 is the wave map; §8 holds the
> questions owed to Stew before any wave opens.

---

## 0. The verdict

**Yes — this is feasible, and more cheaply than it first looks.** The
architecture already made the three decisions that matter:

1. **The deck is a pure reducer** (`editor/deck.js`) — no Fabric, no DOM,
   no fetch. It runs on a phone unchanged, byte for byte.
2. **The frontend is the brain, the backend only the hands** (CLAUDE.md
   §3). Every hand the Express server lends — folder reading, export
   writing, ML — either has a browser-native equivalent on iOS (photo
   picker, share sheet) or is a thing the mobile version cuts by design.
   Nothing in deck/canvas/card logic touches the server.
3. **Graceful ML degradation is already a requirement, not a wish.**
   Stamp and Reverberate carry a designed no-sidecar mode ("the erase
   brush becomes the scissors"); `cardAvailability.js` already gates
   cards a machine can't run. "A phone with no sidecar" is just the
   permanent case of a state the app already handles.

Three more accidents of history work in our favor:

- **The pasteboard** (canvas_pasteboard_plan) made the Fabric buffer
  window-sized with the artboard floating inside, tracked by a
  ResizeObserver — the canvas already fits *any* viewport, a phone's
  included. The camera (`canvasNav`) is the desktop-input part; the
  geometry is done.
- **`sampleImages` already has a client-side fallback** — hand it a list
  of filenames and it shuffles locally when `/api/images/sample` fails.
  The serverless path exists; it's currently labeled "fallback."
- **Bundled card art needs no backend** — `cardArt.js` globs
  `assets/cards/*.png` at build time; external sets are an optional
  first tier. A static build ships every face.

**The delivery answer is a static PWA**: one `vite build`, hosted on any
static host (GitHub Pages / Netlify / Cloudflare Pages), opened in
Safari, added to the home screen. No App Store, no TestFlight, no server
running anywhere — the phone does everything, and the photos never leave
it. This matches Stew's instinct exactly: browser-based is not the
compromise here, it's the *right* shape, because the app was already a
browser app pretending to need a desktop.

**The one genuine risk is memory** (§4): iOS Safari has a hard canvas
memory budget, and the desktop master is 2400×3000 with several
master-resolution scratch layers alive during brush cards. This is why
Wave 0 is an on-device proof, not UI work — we answer the only killer
question first, on Stew's actual phone, before building anything.

---

## 1. What the pocket version is

The same tool, smaller: pick photos from the camera roll instead of an
input folder, run the same arc — opening pick (place one, stash one) →
placement with the standing mask brush → Act I → Act II → the Coda →
export to the camera roll. Commitment stays absolute; closing the tab
still loses in-progress work, by design. The tone rules (§1 of
CLAUDE.md) apply in full — the phone face is still a studio, not a game.

### 1.1 The card cut

Sorted by *why*, because the reasons are the policy for every future
card. A card is cut only for one of three causes: it needs the ML
sidecar, it carries heavyweight dependencies, or its input grammar is
desktop-shaped.

**Keep — pure canvas, touch-ready** (the collage / blend / brush core
Stew named):

| Card | Family | Notes |
|---|---|---|
| Ghost, Stain | Graft | grid pick → place → mask brush; all touch |
| Stamp | Graft (cutout) | ships in its **designed degraded mode**: full image placed, erase brush as scissors (§8 Q4) |
| Reverberate | Stamp brush | same degrade — impressions of the whole image |
| Rails, Char | Stencil | stencil composite is plain canvas |
| Dust, Bruise, Blur | Reveal brush | `ctx.filter` needs iOS 18+ (§4.3) |
| Smieer | Brush | pure pixel pickup/deposit |
| Steep, Hue, Cure | Wash | blend modes are native canvas — cheap everywhere |
| Fracture, Gwarp | Fracture family | CPU geometry, no ML |
| Closer | Re-frame | the honest crop, no restoration to fetch |
| Searcher, Skim, Delay | Deck | pure reducer actions + panel UI |
| Stash Return, Coda | — | reducer beats |

**Cut — ML sidecar** (exactly Stew's list): **Deeper** (Real-ESRGAN
upscale), **Splatt** (depth cast — also drags in three.js + the
gaussian-splats library, the two heaviest deps in `package.json`),
**Transfer / Shattered Transfer** (already stashed on desktop too).

**Defer — desktop-shaped input, revisit after Wave 3**: **Etch** (dives
the camera to the master's grain; pixel-precise glyphs under a finger
warrant their own design pass), **Lift** (marquee-drag + carry + click
to stamp — might translate to touch fine, might not; try it on-device
before deciding), **Rack** (already retired on desktop).

### 1.2 The mobile house deck

A fixed starter deck drawn from the kept cards — same `MOD_CARDS` pool,
a different spec (copies TBD with Stew, §8 Q3). **No deck editor in v1**;
the reducer already takes a `deckSpec`, so a mobile deck editor later is
UI work only. No card-set folders — bundled faces only.

### 1.3 Not in the mobile version, ever-until-argued

Foundry (Stew's call — not necessary), the copy editor, external card
sets, the ML setup flow, folder configuration, the keyboard grammar
(hotkeys.md stays a desktop document).

---

## 2. Cutting the cord — every backend hand, replaced

The complete inventory of what the frontend asks the server for, and the
serverless answer. This table is the whole §2 because there is nothing
else — no deck logic crosses the wire.

| Desktop endpoint | What it's for | Mobile replacement |
|---|---|---|
| `/api/images` + `/sample` | list/sample the input folder | **the session pool**: photo picker (`<input type="file" accept="image/*" multiple>` opens the iOS photo sheet) → object URLs; `sampleImages`'s existing client-side shuffle does the rest |
| `/api/images/<file>` | serve one image | object URL from the pool (see the seam, §2.1) |
| `/api/export` | write PNG to the output folder | `master.toBlob()` → **Web Share API** (`navigator.share({ files })` → "Save Image" lands it in Photos); download-link fallback |
| `/api/config`, `/api/pick-folder`, `/api/open-output` | per-machine folders | gone — there are no folders |
| `/api/decks` | saved deck specs | `localStorage` (a later wave; v1 is the fixed mobile deck) |
| `/api/cards` (sets) | external face sets | gone — bundled art tier already works with the fetch failing |
| `/api/ml/*` | cutout / upscale / splat / style | gone — the cut list *is* the replacement |
| `/api/fonts`, `/api/plates`, `/api/panel-art`, `/api/foundry/export` | Foundry | gone with Foundry |

Privacy falls out for free: a static build with no server means Stew's
photos are opened, composed, baked, and exported **entirely on the
phone**. Nothing uploads, ever. Worth a line of UI copy.

### 2.1 The one real seam: the image store

The single honest refactor this plan requires. `/api/images/${filename}`
is currently hardcoded in ~8 places (graftCardFactory, char, rails,
stamp, reverberate, shatteredTransfer, stashReturn, GridPicker,
placement). Introduce **`editor/imageStore.js`** — one function,
`imageUrl(filename)`, plus the pool listing — with two flavors:

- **served** (desktop): returns `/api/images/<f>`, exactly today's URLs;
- **local** (mobile): returns the object URL for the picked file.

`GridPicker` already takes a `fileUrl` prop with the served default —
the pattern exists; this wave just finishes it. The refactor lands on
`main` first, desktop passes through unchanged, and every card file
stops knowing where images come from. (This is Wave 1, and it's the only
place mobile work touches desktop code paths.)

---

## 3. The screen — reconfiguring the UI for touch

### 3.1 What the layout becomes

Luck again: the artboard is fixed **portrait** 4:5 — a phone held
normally is its natural frame. The desktop's three-column arrangement
(canvas + side-stack panel) becomes:

- **The canvas fills the screen.** Fit-and-center (`canvasNav.reset()`
  already does this math against the live buffer) with a slimmer margin.
- **The deck docks at the bottom edge, thumb reach.** *The deck is the
  button* survives untouched — one tap commits and deals; the flip stays
  the turn separator. It's arguably a better phone interaction than a
  desktop one.
- **Card tools live in a bottom sheet** that slides up over the lower
  third: the card's name, its description, its sliders. The desktop
  Tools components are already small stacks of labeled `<input
  type="range">` — they translate to touch directly (thicker thumbs via
  CSS, no logic change). Collapsed, the sheet is a grab-handle strip so
  the piece stays visible while brushing.
- **Overlays** (grid picks, Searcher's remains, the Coda room) are
  already canvas-covering panels — on the phone they're simply
  full-screen. The 6×4 opening grid probably re-flows to 3×8 or a
  scrolling 2-up; a sizing decision for Wave 2, not an architecture one.
- **The deck overlay** (spent / remains) becomes a swipe-up or a tap on
  the dock — same selectors, same legibility policy (order-stripping
  stays in `deck.js` where it lives).

### 3.2 The touch grammar

The standard drawing-app grammar (Procreate's, roughly), mapped onto
what exists:

- **Two fingers = the camera.** Pinch zooms, two-finger drag pans —
  replacing Ctrl+scroll and Space+drag. `canvasNav` gains a touch
  module; its `isPanning(canvas)` convention (brushes stand down while
  the camera moves) already exists and carries over unchanged. Two
  fingers landing mid-stroke should *cancel* the stroke (the
  stroke-record engine makes this clean — drop the in-progress stroke,
  replay the rest).
- **One finger = the tool.** In arrange mode it moves/scales/rotates the
  placed image (Fabric 6 speaks pointer events — touch drag and corner
  handles already work; add pinch-on-object scale + two-finger-twist
  rotate for direct manipulation, since handles are fiddly at phone
  size). In a brush mode it paints. The desktop's mode buttons
  (arrange / conceal / restore / soften) already exist as UI in the
  panel — on the phone they're the tab row of the bottom sheet.
- **Brushes work today.** `brushCore` listens to Fabric pointer events;
  strokes are recorded points + settings. Two desktop affordances need
  substitutes: bracket keys → the size slider (already there);
  Shift+drag resize → nothing, the slider suffices. And a happy
  accident: **brush size is screen-constant by design** — zoom is the
  precision control — which is *exactly* the right behavior for a small
  screen. That decision was made for the desktop and pays off double
  here.
- **Hotkey accents** (N re-rolls a hue, G resets Gwarp's lattice…)
  become small buttons in each card's sheet, or are dropped per card.
  `keymap.js` simply doesn't load; nothing depends on it existing.

### 3.3 The browser-platform plumbing

The unglamorous list that makes a canvas app feel native on iOS Safari:

`touch-action: none` on the canvas wrap (else Safari scrolls/zooms the
page mid-stroke) · `viewport-fit=cover` + safe-area insets (the notch,
the home bar) · `100dvh`, never `100vh` · suppress double-tap zoom and
long-press callout on the canvas · `overscroll-behavior: none` (no
rubber-banding) · PWA manifest with `display: standalone` (home-screen
launch hides Safari chrome — real estate matters at 390×844) · a
`beforeunload`-equivalent is *not* wanted (closing loses work by
design) but a Screen Wake Lock during a session is · object URLs
revoked when the pool changes (memory, §4).

---

## 4. The pixels — memory and performance budget

The one section where feasibility is genuinely at stake.

### 4.1 The arithmetic

The master is 2400×3000 RGBA ≈ **29 MB** of canvas memory. It is not
alone: the universal bake materializes a second full-res canvas
(`toCanvasElement`), and a reveal-brush card holds master-resolution
scratch layers (committed + live + composite) — a brush round can
plausibly have **4–6 master-sized canvases alive ≈ 120–175 MB**, plus
Fabric's buffer, plus the picked photos. iOS Safari enforces a total
canvas memory budget that varies by device and OS; recent iPhones
usually tolerate this, older ones kill the page. The desktop's WebGL
texture-cap trap (CLAUDE.md §6) has the same shape at 3× bake scale.

### 4.2 The knob that already exists

`masterRaster.js` is **dimension-agnostic by construction** (Foundry
already passes its own master dims), and `MASTER_SCALE` is one exported
constant that every consumer imports. The mobile shell passes a smaller
scale — **2× → a 1600×2000 master**: 12.8 MB per layer (56% less),
bakes ~2.3× cheaper, still a real print (≈5.3×6.7″ at 300 dpi) and far
beyond any screen. Cards never hardcode the numbers, so this is a
constructor argument, not a refactor. Whether 2× is acceptable for the
pocket version — or whether new-enough iPhones should get the full 3× —
is Stew's call (§8 Q2), *informed by Wave 0's measurements, not
guessed*.

### 4.3 The floor and the traps

- **iOS 18 is the floor**: 2d `ctx.filter` (Blur / Hue / Ghost's
  pipelines) silently no-ops below Safari 18 — the known trap from
  CLAUDE.md §6, now a hard minimum. Detect once at launch and say so
  plainly; in 2026 this excludes very little.
- **EXIF orientation**: camera-roll photos arrive rotated by metadata.
  Modern Safari applies EXIF at decode, but verify in Wave 0 with a
  real sideways photo — a silently rotated graft would be maddening.
- **Picked-photo size**: a 48 MP HEIC decodes to ~190 MB of bitmap.
  The pool must **downscale at intake** — decode via
  `createImageBitmap` with `resizeWidth` capped near the master's long
  edge, then work from the downscaled bitmap. Sources never need more
  resolution than the master they'll be baked into.
- **`enableRetinaScaling: false`** (the pasteboard's existing choice) is
  load-bearing on the phone: a 3× DPR iPhone would otherwise triple the
  buffer. Already decided correctly; don't revisit.

### 4.4 Wave 0 is the answer, not this section

Every number above is an estimate. The spike (§7) measures the real
ceiling on Stew's actual iPhone before a line of UI exists.

---

## 5. Where the code lives — the "separate space" question

Stew's instinct ("build it out in a separate space") is right about the
*shell* and would be costly for the *cards*. The recommendation:

**Same repo, third wing: a second Vite entry, one shared core.**

```
frontend/
├── index.html            # desktop entry (unchanged)
├── mobile.html           # → src/mobile/main.jsx
└── src/
    ├── editor/           # THE SHARED CORE — deck.js, masterRaster,
    │                     #   brushCore, canvasNav(+touch), cards/*,
    │                     #   Card.jsx, imageStore (Wave 1), …
    ├── mobile/           # the mobile shell: session flow, bottom
    │                     #   sheet, deck dock, touch bindings, pwa/
    └── …                 # desktop shell as today
```

**Why not a separate repo**: the card behaviors *are* the product. A
fork copies ~30 behavior files and they diverge on the first bug fix —
every card improvement would land twice or drift. The repo already set
the precedent: **Foundry is a second wing behind a lazy chunk**, sharing
`masterRaster` and `Card.jsx` with different dimensions. Mobile is the
same move with its own entry point. Vite's multi-page build emits both
from one `vite build`; the mobile bundle simply never imports three.js,
the splats library, Foundry, or the desktop shell (they're behind the
entries/lazy chunks that don't load).

**What gets built new** is exactly the desktop-shaped layer: Editor.jsx
(~900 lines of orchestration wired to a sidebar layout), DeckPanel, the
keymap. Whether the mobile shell duplicates Editor's orchestration or
Editor first yields a headless `useSession` hook both shells share is a
real design fork — flagged in §8 Q6 rather than decided here, because
extracting it touches the desktop's most central file and deserves its
own conversation.

**Deploy**: static host serving the built `mobile.html` at its own URL
(free tiers all suffice; HTTPS comes with them and the Share API
requires it). Add-to-home-screen via the PWA manifest; a service worker
for offline opening can come last — it's dressing, not structure.

---

## 6. What this plan does *not* change

The desktop app. Wave 1's seams (image store, export provider, master
dims already parameterized) are refactors the desktop passes through
with identical behavior — everything else is additive in `src/mobile/`.
No desktop card, panel, or hotkey changes. `deck.js` stays pure and
shared; if the mobile deck needs different TUNING, the reducer grows a
tuning parameter the desktop defaults — never a fork of the rulebook.

---

## 7. The waves

Checkpoint map, same contract as every plan: one wave at a time, Stew
verifies on the actual phone between waves, the sequence below is the
suggested order and the *first wave is a gate* — if Wave 0 fails on the
target device, we stop and rethink resolution before any UI exists.

- **Wave 0 — the on-device proof.** A single throwaway page (no deck,
  no shell): photo picker → place two images with touch → mask-brush a
  few strokes → universal bake at the mobile master → repeat the bake
  ~10× (a session's worth) → export via the share sheet into Photos.
  Instrument canvas allocation; try 2× and 3× masters. **Answers, on
  Stew's iPhone: the memory ceiling, EXIF behavior, `ctx.filter`, and
  whether touch + Fabric feel right.** Everything else in this plan is
  contingent on this wave's numbers.
- **Wave 1 — the seams (lands on `main`).** `imageStore.js` replacing
  the ~8 hardcoded `/api/images` sites; an export provider (served /
  share-sheet); verify master-dims threading. Desktop verified unchanged
  in the browser — this wave is *for* the desktop's safety.
- **Wave 2 — the mobile shell walks the arc.** `mobile.html` + shell:
  photo intake → opening grid → placement → working rounds → Coda →
  export. Fixed fit-to-screen camera (no gestures yet), bottom-sheet
  tools, the deck dock. Only Ghost/Stain + washes enabled — enough card
  variety to walk a whole session.
- **Wave 3 — the touch grammar.** Two-finger camera on `canvasNav`,
  pinch/twist on placed objects, stroke-cancel on second touch, brush
  feel pass, overlay sizing. This wave is tuning-heavy — expect
  iteration with Stew's thumbs, not just his eyes.
- **Wave 4 — the deck fills in.** Enable the kept cards one at a time,
  each verified on-device; decide the deferred trio (Etch, Lift,
  Stamp's degrade) on evidence; set the mobile house deck with Stew.
- **Wave 5 — the dressing.** Manifest, icon, standalone display,
  wake lock, hosting, the add-to-home-screen note, launch copy (which
  lives in `uiText.json` like all copy). Optional: offline service
  worker, saved decks in localStorage.

---

## 8. Questions owed to Stew (before the wave that needs each)

1. **The target device** (before Wave 0): which iPhone and iOS version?
   The memory budget and the iOS-18 floor are set by the actual phone,
   not the market.
2. **Export resolution** (after Wave 0's numbers): is a 1600×2000
   export acceptable for the pocket version, or must it match the
   desktop's 2400×3000 (possibly gated on newer devices)?
3. **The mobile house deck** (Wave 4): which kept cards, how many
   copies? Same acts tuning (4+2), or shorter sessions for the bus?
4. **Stamp's fate** — your "(stamp?)": on the phone Stamp *always* runs
   its designed degraded mode (whole image + erase-brush scissors, no ML
   cutout ever). Is that a card you'd deal, or does it join the cut?
5. **One repo, third wing** (§5) vs. a separate repo — the plan
   recommends same-repo; confirm before Wave 1.
6. **The shell question** (before Wave 2): mobile shell as its own
   orchestrator (duplicating ~Editor's wiring, zero desktop risk), or
   extract a shared headless session hook first (less duplication,
   touches the desktop's core file)?
7. **Photo intake shape** (Wave 2): re-pick photos each session (purest,
   zero persistence), or a persisted pool the session samples from
   (closer to the desktop's input folder)? Either stays on-device.
8. **The name and face**: what does the pocket version call itself?
   (Tone rules apply; "Deck" and the zyme register travel — the answer
   here is copy, not code.)
