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
>
> **2026-08-29, Stew's answers**: target device **iPhone 17 (non-Pro),
> iOS 26.6.1** — comfortably above every floor here; **1600×2000 export
> approved**; and one requirement raised to first priority: **the pocket
> version must pull images from the zymebox server** (the studio's
> always-on ComfyUI recursion box, `server_plan.md`'s v1 — gallery over
> Tailscale). The phone's own photo library is the secondary source.
> §2.2 is the new zymebox track; §8 is updated accordingly.

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
| `/api/images` + `/sample` | list/sample the input folder | **the zymebox folder, read directly from the phone** (§2.2 — primary), with the photo picker as the secondary source; `sampleImages`'s existing client-side shuffle does the rest |
| `/api/images/<file>` | serve one image | a zymebox URL or an object URL from the picked pool (the seam, §2.1) |
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

With the zymebox requirement the store has **three flavors**, and a
session pool may mix the last two:

- **served** (desktop): `/api/images/<f>`, exactly today;
- **remote** (mobile, primary): filenames listed from a zymebox HTTP
  folder, URLs resolved against it (§2.2);
- **local** (mobile, secondary): object URLs from the photo picker.

### 2.2 The zymebox connection — the primary image source

Zymebox is the studio's always-on recursion server: it already serves a
gallery page over Tailscale, and the *desktop* app already reads HTTP
image folders — `backend/image-source.js` lists a remote folder by
trying `index.json`, then a JSON autoindex, then plain directory-page
hrefs. The mobile version needs the same read **without the backend in
the middle**, and the desktop code documents exactly why the backend was
in the middle: *"a cross-origin image taints the canvas and
`toDataURL()` throws"* — which on mobile would mean a session that works
perfectly until export fails at the Coda. The worst possible failure
shape for a commitment-based tool. So the zymebox track is three small
problems, none of them hard:

1. **Origin.** Two clean solutions, either acceptable:
   - **Host the pocket app on zymebox itself** (recommended): the static
     build is just files; the box already serves a gallery page. App and
     images share an origin — CORS and tainting vanish entirely, and
     "the pocket version's URL" is a zymebox URL. One server owns the
     whole experience.
   - **CORS headers on the image folder** (`Access-Control-Allow-Origin:
     *` on the folder route — one line of nginx/Caddy config), with the
     app hosted anywhere and images loaded `crossOrigin: 'anonymous'`.
2. **Secure context.** Plain `http://` over the tailnet is not a secure
   context, which quietly disables the Share API (export to Photos) and
   service workers. **Tailscale Serve** solves this in one command: it
   fronts a local port with a valid HTTPS cert at
   `https://zymebox.<tailnet>.ts.net` — full secure context, no cert
   management. The fallback if HTTPS is deferred: export renders the
   PNG into an `<img>` for long-press → Save to Photos, which works on
   plain http. Wave 0 measures both paths.
3. **The listing, client-side.** Port `image-source.js`'s listing logic
   (`namesFromJson` / `namesFromHtml` / `keepImages`, ~80 lines, almost
   dependency-free) into the shared frontend so the remote flavor of the
   image store reads the same folder shapes the desktop does — same
   `index.json` contract, same autoindex fallbacks, same 30s listing
   TTL spirit. One convention, both apps (the vat's §1 folder contract
   holds: nothing couples beyond "images appear in a folder").

Reachability falls out of what already works: the gallery is reachable
from the phone over Tailscale today, so "on the go" means the Tailscale
app on the phone — at home, away, anywhere. When zymebox is unreachable
the photo picker is the session's source; the store's remote flavor
degrades exactly like `image-source.js` does (a listing you have beats a
dead deck; a broken image is one broken tile).

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

**Wave 1 finding — "a constructor argument" is half true.** The master's
*dimensions* are already a parameter (Foundry passes its own), but
`MASTER_SCALE = 3` is a shared module constant, and the seating and
cropping math reads it rather than deriving it from the master it was
handed: `showMaster` seats the base image at `1 / MASTER_SCALE`, and
`bake` computes the crop as `src.width / MASTER_SCALE` and renders with
`toCanvasElement(MASTER_SCALE)`. Three other modules import the constant
too (`liftSession`, `fractureField`, `etch`). So a 1600×2000 master under
today's code would seat and crop against a 3× divisor and shrink the
scene-unit artboard to 533⅓×666⅔ — the piece would bake wrong, silently,
in the desktop's own filter-flush way.

The fix is small and mechanical (derive the scale from `master.width /
CANVAS_WIDTH`, or thread it through the master object the way dimensions
already are), but it is **deliberately not done in Wave 1**, because it
may never be needed: the target is an iPhone 17, and if Wave 0 measures
the full 3× master as comfortable on that device, the mobile shell runs
the desktop's numbers unchanged and this constant stays a constant.

**Trigger condition:** parameterize `MASTER_SCALE` only if Wave 0 reports
that a 2400×3000 master cannot hold a session on the target phone. If it
can, close this note. Either way the decision is Wave 0's to make, not
this section's.

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

**Deploy**: the recommendation moved with the zymebox requirement —
**serve the built `mobile.html` from zymebox itself**, fronted by
Tailscale Serve for HTTPS (§2.2): same-origin images, secure context,
one box owning the whole experience, reachable anywhere the phone's
Tailscale is on. The public-static-host + CORS route stays as the
documented alternative.

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
  no shell): photo picker **and a zymebox folder URL field** → place two
  images with touch → mask-brush a few strokes → universal bake at the
  mobile master → repeat the bake ~10× (a session's worth) → export via
  the share sheet into Photos (long-press fallback beside it).
  Instrument canvas allocation; try 2× and 3× masters. For the zymebox
  leg, the page lists the folder client-side, loads an image, and
  **reports in plain words whether the canvas is tainted** — the
  CORS/origin answer that shapes §2.2's deployment choice. **Answers,
  on Stew's iPhone: the memory ceiling, zymebox reachability + taint,
  EXIF behavior, `ctx.filter`, share-sheet availability over http, and
  whether touch + Fabric feel right.** Everything else in this plan is
  contingent on this wave's findings.
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

Answered 2026-08-29:

1. ~~**The target device**~~ — **iPhone 17 (non-Pro), iOS 26.6.1.**
   Far above the iOS-18 floor; the memory arithmetic in §4 has real
   headroom, but Wave 0 still measures rather than assumes.
2. ~~**Export resolution**~~ — **1600×2000 approved** for the pocket
   version.
7. ~~**Photo intake shape**~~ — superseded by the zymebox requirement
   (§2.2): **zymebox is the primary source**, the photo picker the
   secondary; a session pool may mix both.

Still open:

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
8. **The name and face**: what does the pocket version call itself?
   (Tone rules apply; "Deck" and the zyme register travel — the answer
   here is copy, not code.)
9. **The zymebox folder URL and its server** (before Wave 2 hardens
   §2.2): what serves the image folder today (nginx? Caddy? the gallery
   app?), what does its listing look like (`index.json`? autoindex?),
   and is Tailscale Serve acceptable on that box for HTTPS? Wave 0's
   URL field will answer the listing-shape part empirically.
10. **Zymebox hosting of the app itself** (Wave 5): confirm the
    recommendation — the pocket app served from zymebox behind
    Tailscale Serve — once Wave 0 reports on taint and share-sheet
    behavior.
