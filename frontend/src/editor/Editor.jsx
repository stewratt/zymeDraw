import { Suspense, lazy, useEffect, useReducer, useRef, useState } from 'react'
import CanvasStage, { CANVAS_WIDTH, CANVAS_HEIGHT } from './CanvasStage.jsx'
import DeckPanel from './DeckPanel.jsx'
import GridPicker from './GridPicker.jsx'
import KeysReference from './KeysReference.jsx'
import HistoryOverlay from './HistoryOverlay.jsx'
import { TUNING, deckReducer, initialState, remainingCounts } from './deck.js'
import { cardRegistry } from './cards/registry.jsx'
import { placeImages, layerThumbUrl } from './placement.js'
import { sampleImages } from './sampling.js'
import { createMaskSession } from './brushCore.js'
import { attachCanvasNav } from './canvasNav.js'
import { dispatchKey } from './keymap.js'
import { arrangeBindings, brushBindings } from './sessionBindings.js'
import { randomHexColor, randomizeColors } from './colorSeed.js'
import { UI, fmt } from '../copy/uiText.js'
import {
  bake,
  createMaster,
  masterThumbDataUrl,
  masterToPngDataUrl,
  showMaster
} from './masterRaster.js'
import './editor.css'

// The finished-piece viewer (three.js) — lazy so its weight only downloads
// when a piece is actually finished, never during a working session.
const Plinth = lazy(() => import('./Plinth.jsx'))

// Editor is a generic dispatcher. It doesn't know what any card does — it
// looks up the current card in cardRegistry and calls
// begin/update/commit/cleanup at the right times. The session arc itself
// (pick → placement → acts → Coda) lives in deck.js; Editor's only
// arc-specific jobs are the impure work the reducer can't do: sampling the
// opening grid, the universal bake on every End, and exporting on COMPLETE.
function Editor({ config, deckSpec, onBackToSetup }) {
  // deckSpec is the deck editor's output (null = the house deck); it seeds
  // the session and rides state.deckSpec so Restart rebuilds the same deck.
  const [state, dispatch] = useReducer(deckReducer, deckSpec ?? null, initialState)

  const canvasStageRef = useRef(null)
  const cardSessionRef = useRef(null) // opaque per-card data the registry owns
  const masterRef = useRef(null) // the full-resolution truth (masterRaster.js)
  const navRef = useRef(null) // canvasNav: the zoom/pan lens on the proxy

  // Per-card UI state: controls (slider values etc.), info (data the Tools
  // component renders), ready (true once begin has finished).
  const [cardControls, setCardControls] = useState({})
  const [cardInfo, setCardInfo] = useState({})
  const [cardReady, setCardReady] = useState(true)

  // False while a placement session's images are still loading, so End
  // can't bake a half-loaded arrangement.
  const [placementReady, setPlacementReady] = useState(true)

  // The images being placed this session, top-to-bottom, for the layers
  // panel. Each: { id, name, thumb, img (the Fabric object) }. Reordering
  // restacks the Fabric objects; only meaningful with two or more images.
  const [placedLayers, setPlacedLayers] = useState([])

  // The standing mask brush (brushCore.js), live during placement sessions.
  // Controls live in React; the session reads them through a ref so
  // mid-stroke slider changes don't rebuild anything. `mode` is arrange or
  // one of the brush ops (conceal / restore / soften).
  const maskSessionRef = useRef(null)
  const maskControlsRef = useRef(null)
  const [maskControls, setMaskControls] = useState({ mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 })
  const [maskHistory, setMaskHistory] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    maskControlsRef.current = maskControls
    maskSessionRef.current?.setActive(maskControls.mode !== 'arrange')
  }, [maskControls])

  // Stash-return tone: the stash was chosen rounds ago, against a piece
  // that has since moved on — hue/saturation lets it ease into the
  // composition. Ghost's mechanism exactly: the image element becomes a
  // canvas redrawn from the original through 2d ctx.filter BEFORE the mask
  // session captures it as source, so tone, brush strokes, and the bake
  // stack cleanly at full resolution.
  const stashToneRef = useRef(null) // [{ original, filtered }] while returning
  const [stashTone, setStashTone] = useState({ h: 0, s: 100 })

  useEffect(() => {
    const entries = stashToneRef.current
    if (!entries) return
    for (const { original, filtered } of entries) {
      const fctx = filtered.getContext('2d')
      fctx.save()
      fctx.clearRect(0, 0, filtered.width, filtered.height)
      fctx.filter = `hue-rotate(${stashTone.h}deg) saturate(${stashTone.s}%)`
      fctx.drawImage(original, 0, 0)
      fctx.restore()
    }
    maskSessionRef.current?.refresh()
  }, [stashTone])

  // True while an (async) card commit is running — End disabled, generic
  // "Committing…" label. The ref guards re-entry across renders.
  const committingRef = useRef(false)
  const [committing, setCommitting] = useState(false)

  // Export state. Driven by a useEffect that fires when the deck
  // transitions to COMPLETE. Reset on Restart.
  const [exportState, setExportState] = useState({ status: 'idle', savedPath: null, error: null })

  // The Keys reference overlay (header button). While open it blocks the
  // whole keymap itself (KeysReference swallows keys at the capture phase).
  const [keysOpen, setKeysOpen] = useState(false)

  // The deck overlay (v4): spent sequence + remaining multiset. Same modal
  // pattern as the Keys reference.
  const [historyOpen, setHistoryOpen] = useState(false)

  // The state cache (v4 notes §9): every universal bake keeps a full-res
  // JPEG of the master, captioned by what just committed. Viewed only at
  // the Coda — C cycles the plinth through them. The plate only moves
  // forward: no state is exported or re-entered (the capture keeps that
  // door open for later). Session-local: Restart clears it.
  const [states, setStates] = useState([]) // [{ url, label }]

  function captureState(master, label) {
    setStates((prev) => [...prev, { url: master.toDataURL('image/jpeg', 0.92), label }])
  }

  const [imageList, setImageList] = useState({
    status: 'loading',
    filenames: [],
    error: null
  })

  // Fetch input folder once.
  useEffect(() => {
    fetch('/api/images')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setImageList({ status: 'ready', filenames: data.filenames, error: null })
        else setImageList({ status: 'error', filenames: [], error: data.error })
      })
      .catch((err) => setImageList({ status: 'error', filenames: [], error: err.message }))
  }, [])

  // The reducer never touches the filesystem: when the opening grid is
  // needed, Editor samples the input folder (sampling.js) and reports it
  // back via SET_GRID. Waits for the folder listing so the loading/error
  // states in DeckPanel get their moment instead of a dangling fetch.
  useEffect(() => {
    if (state.phase !== 'OPENING_PICK' || state.grid.length > 0) return
    if (imageList.status !== 'ready' || imageList.filenames.length === 0) return
    let cancelled = false
    ;(async () => {
      const filenames = await sampleImages(TUNING.openingGrid, imageList.filenames)
      if (!cancelled && filenames.length > 0) dispatch({ type: 'SET_GRID', filenames })
    })()
    return () => {
      cancelled = true
    }
  }, [state.phase, state.grid.length, imageList])

  // Entering a placement session (opening or stash return) loads the chosen
  // images onto the canvas as free-transform objects and arms the mask
  // brush over them. The cancelled flag covers restarts while images are
  // still in flight.
  useEffect(() => {
    if (state.phase !== 'PLACEMENT' && state.phase !== 'STASH_RETURN') return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    setPlacementReady(false)
    setPlacedLayers([])
    setMaskControls({ mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 })
    setMaskHistory({ canUndo: false, canRedo: false })
    setStashTone({ h: 0, s: 100 })
    placeImages(canvas, state.toPlace, () => cancelled)
      .then((imgs) => {
        if (cancelled || imgs.length === 0) return
        // The stash return gets the tone controls: swap each element for a
        // redrawable canvas before the mask session snapshots its source.
        stashToneRef.current =
          state.phase === 'STASH_RETURN'
            ? imgs.map((img) => {
                const original = img.getElement()
                const filtered = document.createElement('canvas')
                filtered.width = img.width
                filtered.height = img.height
                filtered.getContext('2d').drawImage(original, 0, 0)
                img.setElement(filtered)
                return { original, filtered }
              })
            : null
        maskSessionRef.current = createMaskSession(canvas, imgs, {
          getControls: () => maskControlsRef.current,
          onHistoryChange: (canUndo, canRedo) => setMaskHistory({ canUndo, canRedo }),
          // Shift+drag on the canvas resizes the brush; the slider follows.
          onSizeChange: (size) => setMaskControls((prev) => ({ ...prev, size }))
        })
        // placeImages adds bottom-to-top; the panel reads top-to-bottom.
        const layers = imgs.map((img, i) => ({
          id: `${state.toPlace[i]}#${i}`,
          name: state.toPlace[i],
          thumb: layerThumbUrl(img),
          img
        }))
        layers.reverse()
        setPlacedLayers(layers)
      })
      .catch((err) => console.warn('Placement image failed to load:', err))
      .finally(() => {
        if (!cancelled) setPlacementReady(true)
      })
    return () => {
      cancelled = true
      maskSessionRef.current?.dispose()
      maskSessionRef.current = null
      stashToneRef.current = null
      setPlacedLayers([])
    }
  }, [state.phase])

  // Create the master raster once the Fabric canvas exists, and show it as
  // the canvas background. The master is the only committed state; the
  // visible canvas is a working proxy.
  useEffect(() => {
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    masterRef.current = createMaster()
    showMaster(canvas, masterRef.current)
    // The zoom/pan lens: one instance for the whole session (canvasNav.js).
    // Space-drag pans, Ctrl/Cmd+wheel zooms; it only moves the proxy's
    // viewportTransform, never the master. Disposed with the canvas.
    navRef.current = attachCanvasNav(canvas)
    return () => {
      navRef.current?.dispose()
      navRef.current = null
    }
  }, [])

  // When a death card is dealt (phase → COMPLETE), write the master out —
  // it already holds the true pixels at 2400×3000, so export is a direct
  // read with no multiplier render. Runs exactly once per transition.
  useEffect(() => {
    if (state.phase !== 'COMPLETE') return
    const master = masterRef.current
    if (!master) return
    let cancelled = false
    setExportState({ status: 'exporting', savedPath: null, error: null, thumbDataUrl: null })
    ;(async () => {
      try {
        const pngBase64 = masterToPngDataUrl(master)
        // A tiny thumbnail for the FINISHED screen. ~320×400 — cheap.
        const thumbDataUrl = masterThumbDataUrl(master)
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pngBase64 })
        })
        const data = await res.json()
        if (cancelled) return
        if (data.ok) {
          setExportState({ status: 'done', savedPath: data.savedPath, error: null, thumbDataUrl })
        } else {
          setExportState({ status: 'error', savedPath: null, error: data.error || UI.editor.exportUnknownError, thumbDataUrl: null })
        }
      } catch (err) {
        if (cancelled) return
        setExportState({ status: 'error', savedPath: null, error: err.message, thumbDataUrl: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.phase])

  // BEGIN hook: when a new card appears, look it up in the registry, reset
  // controls/info, then await its begin() to set up the canvas. This is the
  // bridge between the pure reducer and the impure Fabric world.
  useEffect(() => {
    if (!state.currentCard) {
      cardSessionRef.current = null
      setCardControls({})
      setCardInfo({})
      setCardReady(true)
      return
    }

    const entry = cardRegistry[state.currentCard.id]
    if (!entry) {
      // Placeholder cards (every deck card until its phase lands):
      // no behavior yet, ready immediately, no UI.
      cardSessionRef.current = null
      setCardControls({})
      setCardInfo({})
      setCardReady(true)
      return
    }

    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return

    // Fresh defaults per deal: the color invariant first, then the card's
    // own randomize hook if it declares one (Bruise opens on a small
    // random hue shift).
    let defaults = randomizeColors(entry.defaultControls || {})
    if (entry.randomize) defaults = entry.randomize(defaults)
    setCardControls(defaults)
    setCardInfo({})
    setCardReady(false)

    let cancelled = false
    ;(async () => {
      const ctx = {
        canvas,
        master: masterRef.current,
        controls: defaults,
        imageList: imageList.filenames,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        report: (patch) => setCardInfo((prev) => ({ ...prev, ...patch })),
        // Lets a card session write a control back (shift+drag brush sizing
        // reports through here so the panel slider follows the gesture).
        setControl: (key, value) => setCardControls((prev) => ({ ...prev, [key]: value })),
        // Cards whose begin awaits (Ghost's pick + image load) check this
        // after each await so a restart can't leave objects behind.
        isCancelled: () => cancelled
      }
      const session = entry.begin ? await entry.begin(ctx) : null
      if (cancelled) return
      cardSessionRef.current = session
      setCardReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [state.currentCard, imageList])

  // The nav lens and the card's own viewport must never fight. A card that
  // drives its own viewport (Etch, `ownsViewport`) takes the wheel: suspend
  // the global nav for its whole session and re-enable when it's gone. Reset
  // the view to identity on every card change and phase transition so no
  // zoom/pan ever leaks between rounds (the bake also resets — this keeps the
  // *screen* honest between commits, not just the baked pixels). Keyed on the
  // card + phase so it runs at every deal, End, and transition.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const entry = state.currentCard ? cardRegistry[state.currentCard.id] : null
    nav.reset()
    nav.setEnabled(!entry?.ownsViewport)
  }, [state.currentCard, state.phase])

  // UPDATE hook: when the user changes a control, let the registry react
  // (e.g. Pencil re-sets brush size/color on the fly).
  useEffect(() => {
    if (!state.currentCard) return
    const entry = cardRegistry[state.currentCard.id]
    if (!entry?.update) return
    if (!cardReady) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    entry.update({
      canvas,
      master: masterRef.current,
      controls: cardControls,
      session: cardSessionRef.current,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT
    })
  }, [cardControls, state.currentCard, cardReady])

  // Keyboard: one persistent listener; the bindings it walks are rebuilt
  // every render (below, after the handlers they close over) so each run
  // sees current state. keymap.js owns matching and form-field suppression.
  const bindingsRef = useRef([])
  useEffect(() => {
    const onKeyDown = (e) => dispatchKey(bindingsRef.current, e)
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleControlChange(key, value) {
    setCardControls((prev) => ({ ...prev, [key]: value }))
  }

  // End of a card round: the card's own commit hook finalizes its temp
  // objects, then the UNIVERSAL BAKE flattens the whole canvas into the
  // master. No card implements flattening; this is the v2 commitment step.
  // Commit hooks may be async (Deeper awaits the detail restore); the ref
  // is the re-entry guard, the state drives the "committing" UI.
  async function handleCommit() {
    if (!state.currentCard || committingRef.current) return
    const entry = cardRegistry[state.currentCard.id]
    const canvas = canvasStageRef.current?.getCanvas()
    committingRef.current = true
    setCommitting(true)
    try {
      if (canvas) {
        if (entry?.commit) {
          await entry.commit({
            canvas,
            controls: cardControls,
            session: cardSessionRef.current
          })
        }
        // Cards that never touch the canvas (Searcher's empty-remains round)
        // skip the bake and the state capture — nothing changed.
        if (!entry?.skipBake) {
          masterRef.current = bake(canvas)
          captureState(masterRef.current, fmt(UI.editor.stateAfterCard, { card: state.currentCard.label }))
        }
      }
    } finally {
      committingRef.current = false
      setCommitting(false)
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
    dispatch({ type: 'COMMIT' })
  }

  // Reorder the placement layers panel (top-to-bottom). Restack the Fabric
  // objects to match: the canvas list is bottom-to-top, so the reversed panel
  // order is the target index sequence. moveObjectTo removes-then-inserts, so
  // walking the stack bottom-up lands each object in its final slot.
  function handleReorderLayer(from, to) {
    if (from === to) return
    const next = [...placedLayers]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) {
      ;[...next].reverse().forEach((layer, i) => canvas.moveObjectTo(layer.img, i))
      canvas.requestRenderAll()
    }
    setPlacedLayers(next)
  }

  // End of a placement session (opening or stash return): same universal
  // bake, no card hook involved.
  function handleEndPlacement() {
    if (!placementReady) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) {
      masterRef.current = bake(canvas)
      captureState(
        masterRef.current,
        state.phase === 'STASH_RETURN' ? UI.editor.stateStashReturn : UI.editor.stateOpening
      )
    }
    dispatch({ type: 'END_PLACEMENT' })
  }

  function handleRestart() {
    if (committingRef.current) return // a commit is landing; let it finish
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) {
      // If a card is currently in flight, let it clean up first.
      if (state.currentCard) {
        const entry = cardRegistry[state.currentCard.id]
        entry?.cleanup?.({ canvas, session: cardSessionRef.current })
      }
      canvas.clear()
      canvas.backgroundColor = '#ffffff'
      masterRef.current = createMaster()
      showMaster(canvas, masterRef.current)
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
    setPlacementReady(true)
    setStates([])
    setExportState({ status: 'idle', savedPath: null, error: null, thumbDataUrl: null })
    dispatch({ type: 'RESTART' })
  }

  async function handleOpenOutput() {
    try {
      await fetch('/api/open-output', { method: 'POST' })
    } catch (err) {
      // Non-critical — the path is already shown on screen, this is
      // just a shortcut. Silently swallow network errors.
    }
  }

  const currentEntry = state.currentCard ? cardRegistry[state.currentCard.id] : null
  // Cards can declare a canvas-area overlay (Ghost's grid pick) — rendered
  // generically, same props as Tools.
  const CardOverlay = state.phase === 'WORKING' ? currentEntry?.Overlay : null

  // What a deck-facing card may know and do (v4 Wave 2). deckView carries
  // selector outputs only — the legibility policy stays enforced in deck.js.
  // state.skim is the one raw field: the paid exception, shown only while
  // Skim itself is in hand (the reducer clears it on COMMIT).
  const deckView = { remaining: remainingCounts(state), skim: state.skim }
  // The fence: a card's Overlay may only fire the deck actions its registry
  // entry declares (`deckActions`) — no card ever holds raw dispatch, and
  // the reducer's legality guards remain the real gate.
  const cardDeckActions = new Set(currentEntry?.deckActions ?? [])
  function handleDeckAction(action) {
    if (cardDeckActions.has(action.type)) dispatch(action)
  }

  // ---- the hotkey map (hotkeys.md §5) ----
  // Rebuilt each render, ordered most-specific-first: card accents → brush
  // grammar → arrange → global. keymap.js dispatches (listener above); the
  // brush + arrange grammars live in sessionBindings.js, shared with Foundry.

  const getCanvas = () => canvasStageRef.current?.getCanvas()

  const bindings = []
  const inPlacement = state.phase === 'PLACEMENT' || state.phase === 'STASH_RETURN'
  const cardUp = state.phase === 'WORKING' && !!state.currentCard

  // Card accents (§5.4): declared in the registry (`hotkeys`), live for the
  // whole card — even before ready (Etch's Enter advances the frame stage).
  if (cardUp) {
    for (const hk of currentEntry?.hotkeys ?? []) {
      bindings.push({
        ...hk,
        run: (e) =>
          hk.run(
            {
              controls: cardControls,
              setControl: (key, value) => setCardControls((prev) => ({ ...prev, [key]: value })),
              info: cardInfo,
              session: cardSessionRef.current,
              canvas: canvasStageRef.current?.getCanvas()
            },
            e
          )
      })
    }
    // N re-rolls any `color` control — the random-hue invariant, mid-session.
    if (currentEntry?.controls?.includes('color')) {
      bindings.push({
        key: 'n',
        run: () => setCardControls((prev) => ({ ...prev, color: randomHexColor() }))
      })
    }
  }

  // Brush grammar. Etch has no `size` control, so its bracket accents above
  // take the brackets' place; which mode keys exist follows the registry's
  // control list (no per-card branches).
  if (inPlacement && placementReady) {
    bindings.push(
      ...brushBindings(
        () => maskControls,
        (patch) => setMaskControls((prev) => ({ ...prev, ...patch })),
        { canArrange: true, hasMode: true, hasHardness: true }
      )
    )
  } else if (cardUp && cardReady && currentEntry?.controls?.includes('size')) {
    bindings.push(
      ...brushBindings(
        () => cardControls,
        (patch) => setCardControls((prev) => ({ ...prev, ...patch })),
        {
          canArrange: currentEntry.defaultControls?.mode === 'arrange',
          hasMode: currentEntry.controls.includes('mode'),
          hasHardness: currentEntry.controls.includes('hardness')
        }
      )
    )
  }

  // Arrange keys, wherever a free transform is in hand. Cards without a
  // mode control (Deeper, Rack) count as always arranging; where nothing is
  // interactive the transform simply finds no target.
  const arranging = inPlacement
    ? placementReady && maskControls.mode === 'arrange'
    : cardUp && (!currentEntry?.controls?.includes('mode') || cardControls.mode === 'arrange')
  if (arranging) bindings.push(...arrangeBindings(getCanvas))

  // Global (§5.1), including the one Cmd/Ctrl family we own. Enter never
  // confirms the opening pick (deliberate); the card grids own their Enter
  // locally (GridPicker).
  if (inPlacement) {
    bindings.push(
      { key: 'z', mod: true, shift: false, run: () => maskSessionRef.current?.undo() },
      { key: 'z', mod: true, shift: true, run: () => maskSessionRef.current?.redo() }
    )
  } else if (cardUp) {
    bindings.push(
      { key: 'z', mod: true, shift: false, run: () => cardInfo.undo?.() },
      { key: 'z', mod: true, shift: true, run: () => cardInfo.redo?.() }
    )
  }
  if (state.phase === 'WORKING' && !state.currentCard) {
    // Deal is Enter-only now — Space is the canvasNav pan-hold everywhere
    // (issue #53). The two-press rhythm (End, then Deal) is unchanged.
    bindings.push({ key: 'Enter', run: () => dispatch({ type: 'DEAL' }) })
  } else if (state.phase === 'COMPLETE') {
    bindings.push({ key: 'Enter', run: handleRestart })
  } else if (inPlacement && placementReady) {
    bindings.push({ key: 'Enter', run: handleEndPlacement })
  } else if (cardUp && cardReady) {
    bindings.push({ key: 'Enter', run: handleCommit })
  }
  bindings.push(
    // Restart is destructive with no confirm — a single letter was too
    // cheap for it (hotkeys.md §5.1); Shift+R keeps it deliberate and
    // frees plain R for Restore.
    { key: 'r', shift: true, run: handleRestart },
    // The escape hatch for the zoom/pan lens: back to fit/100% (issue #53).
    // A free digit — the only bound digit is C at the Coda, and 0 reads as
    // "reset" in image editors. Bakes reset independently, so this is only
    // the on-screen view.
    { key: '0', run: () => navRef.current?.reset() },
    {
      key: 'Escape', // back out of a selection; never ends or commits
      run: () => {
        const canvas = canvasStageRef.current?.getCanvas()
        if (!canvas?.getActiveObject()) return false
        canvas.discardActiveObject()
        canvas.requestRenderAll()
      }
    }
  )
  bindingsRef.current = bindings

  return (
    <div className="editor">
      <header className="editor-header">
        <button type="button" className="link" onClick={onBackToSetup}>
          {UI.editor.backToSetup}
        </button>
        <h1 className="editor-brand">
          <img src="/logo/zyme.png" alt={UI.editor.title} />
        </h1>
        <div className="header-actions">
          <button type="button" className="link keys-button" onClick={() => setHistoryOpen(true)}>
            {UI.editor.deckButton}
          </button>
          <button type="button" className="link keys-button" onClick={() => setKeysOpen(true)}>
            {UI.editor.keysButton}
          </button>
        </div>
      </header>
      {keysOpen && <KeysReference onClose={() => setKeysOpen(false)} />}
      {historyOpen && <HistoryOverlay state={state} onClose={() => setHistoryOpen(false)} />}

      <main className="editor-main">
        <section className="canvas-area">
          <CanvasStage ref={canvasStageRef} fill />
          {state.phase === 'OPENING_PICK' &&
            imageList.status === 'ready' &&
            imageList.filenames.length > 0 && (
              <GridPicker
                grid={state.grid}
                onConfirm={(placed, stashed) => dispatch({ type: 'CONFIRM_PICK', placed, stashed })}
              />
            )}
          {CardOverlay && (
            <CardOverlay
              controls={cardControls}
              info={cardInfo}
              ready={cardReady}
              onControlChange={handleControlChange}
              deckView={deckView}
              onDeckAction={handleDeckAction}
              workUrl={states.at(-1)?.url}
            />
          )}
          {/* Finished: the piece floats as a 3d panel over the (still
              mounted) working canvas. Until three.js loads, the flat
              canvas simply stays visible — no spinner needed. */}
          {state.phase === 'COMPLETE' && masterRef.current && (
            <Suspense fallback={null}>
              <Plinth master={masterRef.current} states={states} />
            </Suspense>
          )}
        </section>
        <aside className="side-stack">
          <DeckPanel
            state={state}
            imageList={imageList}
            entry={currentEntry}
            controls={cardControls}
            info={cardInfo}
            ready={cardReady}
            committing={committing}
            placementReady={placementReady}
            placedLayers={placedLayers}
            onReorderLayer={handleReorderLayer}
            maskControls={maskControls}
            maskHistory={maskHistory}
            stashTone={stashTone}
            onStashToneChange={(patch) => setStashTone((prev) => ({ ...prev, ...patch }))}
            onMaskControlsChange={(patch) => setMaskControls((prev) => ({ ...prev, ...patch }))}
            onMaskUndo={() => maskSessionRef.current?.undo()}
            onMaskRedo={() => maskSessionRef.current?.redo()}
            exportState={exportState}
            onControlChange={handleControlChange}
            onEndPlacement={handleEndPlacement}
            onDeal={() => dispatch({ type: 'DEAL' })}
            onCommit={handleCommit}
            onAcceptCoda={() => dispatch({ type: 'ACCEPT_CODA' })}
            onDelayCoda={() => dispatch({ type: 'DELAY_CODA' })}
            onRestart={handleRestart}
            onOpenOutput={handleOpenOutput}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        </aside>
      </main>
    </div>
  )
}

export default Editor
