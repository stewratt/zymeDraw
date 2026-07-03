import { useEffect, useReducer, useRef, useState } from 'react'
import CanvasStage, { CANVAS_WIDTH, CANVAS_HEIGHT } from './CanvasStage.jsx'
import DeckPanel from './DeckPanel.jsx'
import GridPicker from './GridPicker.jsx'
import { deckReducer, initialState } from './deck.js'
import { cardRegistry } from './cards/registry.jsx'
import { placeImages, layerThumbUrl } from './placement.js'
import { sampleImages } from './sampling.js'
import { createEraseSession } from './brushCore.js'
import {
  bake,
  createMaster,
  masterThumbDataUrl,
  masterToPngDataUrl,
  showMaster
} from './masterRaster.js'
import './editor.css'

// Any control named `color` starts on a fresh random hue each time the card
// is dealt — a color card should never open on the same swatch twice (its
// default in the registry is just a placeholder). Random hue at fixed
// saturation/lightness keeps the picks vivid rather than muddy.
function randomHexColor() {
  const h = Math.floor(Math.random() * 360)
  const s = 0.65
  const l = 0.55
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x]
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function randomizeColors(defaults) {
  const out = { ...defaults }
  for (const key of Object.keys(out)) {
    if (key === 'color') out[key] = randomHexColor()
  }
  return out
}

// Editor is a generic dispatcher. It doesn't know what any card does — it
// looks up the current card in cardRegistry and calls
// begin/update/commit/cleanup at the right times. The session arc itself
// (rolls → pick → placement → acts → Coda) lives in deck.js; Editor's only
// arc-specific jobs are the impure work the reducer can't do: sampling the
// opening grid, the universal bake on every End, and exporting on COMPLETE.
function Editor({ config, onBackToSetup }) {
  const [state, dispatch] = useReducer(deckReducer, undefined, initialState)

  const canvasStageRef = useRef(null)
  const cardSessionRef = useRef(null) // opaque per-card data the registry owns
  const masterRef = useRef(null) // the full-resolution truth (masterRaster.js)

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

  // The erase brush (brushCore.js), live during placement sessions.
  // Controls live in React; the session reads them through a ref so
  // mid-stroke slider changes don't rebuild anything.
  const eraseSessionRef = useRef(null)
  const eraseControlsRef = useRef(null)
  const [eraseControls, setEraseControls] = useState({ mode: 'arrange', size: 40, hardness: 'soft', strength: 1 })
  const [eraseHistory, setEraseHistory] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    eraseControlsRef.current = eraseControls
    eraseSessionRef.current?.setActive(eraseControls.mode === 'erase')
  }, [eraseControls])

  // True while an (async) card commit is running — End disabled, generic
  // "Committing…" label. The ref guards re-entry across renders.
  const committingRef = useRef(false)
  const [committing, setCommitting] = useState(false)

  // Export state. Driven by a useEffect that fires when the deck
  // transitions to COMPLETE. Reset on Restart.
  const [exportState, setExportState] = useState({ status: 'idle', savedPath: null, error: null })

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
  // back via SET_GRID.
  useEffect(() => {
    if (state.phase !== 'OPENING_PICK' || state.grid.length > 0) return
    let cancelled = false
    ;(async () => {
      const fallback = imageList.status === 'ready' ? imageList.filenames : []
      const filenames = await sampleImages(state.rolls.gridSize, fallback)
      if (!cancelled && filenames.length > 0) dispatch({ type: 'SET_GRID', filenames })
    })()
    return () => {
      cancelled = true
    }
  }, [state.phase, state.grid.length, state.rolls, imageList])

  // Entering a placement session (opening or stash return) loads the chosen
  // images onto the canvas as free-transform objects and arms the erase
  // brush over them. The cancelled flag covers restarts while images are
  // still in flight.
  useEffect(() => {
    if (state.phase !== 'PLACEMENT' && state.phase !== 'STASH_RETURN') return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    setPlacementReady(false)
    setPlacedLayers([])
    setEraseControls({ mode: 'arrange', size: 40, hardness: 'soft', strength: 1 })
    setEraseHistory({ canUndo: false, canRedo: false })
    placeImages(canvas, state.toPlace, () => cancelled)
      .then((imgs) => {
        if (cancelled || imgs.length === 0) return
        eraseSessionRef.current = createEraseSession(canvas, imgs, {
          getControls: () => eraseControlsRef.current,
          onHistoryChange: (canUndo, canRedo) => setEraseHistory({ canUndo, canRedo })
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
      eraseSessionRef.current?.dispose()
      eraseSessionRef.current = null
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
          setExportState({ status: 'error', savedPath: null, error: data.error || 'Unknown error.', thumbDataUrl: null })
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

    const defaults = randomizeColors(entry.defaultControls || {})
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

  // Keyboard shortcuts. Space = advance (roll / deal), Enter = primary
  // action (End / restart — never confirms the opening pick, which needs an
  // explicit choice), R = Restart. Disabled while focus is in any form
  // control so sliders, color pickers and text inputs behave normally.
  useEffect(() => {
    const imagesReady = imageList.status === 'ready' && imageList.filenames.length > 0
    const handler = (e) => {
      const t = e.target
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) {
        return
      }
      // Cmd/Ctrl+Z (+Shift for redo): within-card brush undo. Placement
      // sessions route to the erase brush; cards route to whatever undo the
      // card reported (effect brushes). Never crosses an End.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        if (state.phase === 'PLACEMENT' || state.phase === 'STASH_RETURN') {
          e.preventDefault()
          if (e.shiftKey) eraseSessionRef.current?.redo()
          else eraseSessionRef.current?.undo()
        } else if (state.phase === 'WORKING' && state.currentCard) {
          e.preventDefault()
          if (e.shiftKey) cardInfo.redo?.()
          else cardInfo.undo?.()
        }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === ' ' || e.code === 'Space') {
        if (state.phase === 'OPENING_ROLLS' && imagesReady) {
          e.preventDefault()
          dispatch({ type: 'ROLL_OPENING' })
        } else if (state.phase === 'WORKING' && !state.currentCard) {
          e.preventDefault()
          dispatch({ type: 'DEAL' })
        }
      } else if (e.key === 'Enter') {
        if (state.phase === 'COMPLETE') {
          e.preventDefault()
          handleRestart()
        } else if (
          (state.phase === 'PLACEMENT' || state.phase === 'STASH_RETURN') &&
          placementReady
        ) {
          e.preventDefault()
          handleEndPlacement()
        } else if (state.phase === 'WORKING' && state.currentCard && cardReady) {
          e.preventDefault()
          handleCommit()
        } else if (state.phase === 'WORKING' && !state.currentCard) {
          e.preventDefault()
          dispatch({ type: 'DEAL' })
        } else if (state.phase === 'OPENING_ROLLS' && imagesReady) {
          e.preventDefault()
          dispatch({ type: 'ROLL_OPENING' })
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleRestart()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state.currentCard, state.phase, cardReady, placementReady, imageList, cardInfo])

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
        masterRef.current = bake(canvas)
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

  return (
    <div className="editor">
      <header className="editor-header">
        <button type="button" className="link" onClick={onBackToSetup}>
          ← setup
        </button>
        <h1>DECK</h1>
      </header>

      <main className="editor-main">
        <section className="canvas-area">
          <CanvasStage ref={canvasStageRef} />
          {state.phase === 'OPENING_PICK' && (
            <GridPicker
              rolls={state.rolls}
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
            />
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
            eraseControls={eraseControls}
            eraseHistory={eraseHistory}
            onEraseControlsChange={(patch) => setEraseControls((prev) => ({ ...prev, ...patch }))}
            onEraseUndo={() => eraseSessionRef.current?.undo()}
            onEraseRedo={() => eraseSessionRef.current?.redo()}
            exportState={exportState}
            onControlChange={handleControlChange}
            onRoll={() => dispatch({ type: 'ROLL_OPENING' })}
            onEndPlacement={handleEndPlacement}
            onDeal={() => dispatch({ type: 'DEAL' })}
            onCommit={handleCommit}
            onRestart={handleRestart}
            onOpenOutput={handleOpenOutput}
          />
        </aside>
      </main>
    </div>
  )
}

export default Editor
