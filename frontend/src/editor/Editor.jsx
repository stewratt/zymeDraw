import { useEffect, useReducer, useRef, useState } from 'react'
import CanvasStage, { CANVAS_WIDTH, CANVAS_HEIGHT } from './CanvasStage.jsx'
import DeckPanel from './DeckPanel.jsx'
import GridPicker from './GridPicker.jsx'
import { deckReducer, initialState } from './deck.js'
import { cardRegistry } from './cards/registry.jsx'
import { placeImages } from './placement.js'
import { createEraseSession } from './brushCore.js'
import {
  bake,
  createMaster,
  masterThumbDataUrl,
  masterToPngDataUrl,
  showMaster
} from './masterRaster.js'
import './editor.css'

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

  // The erase brush (brushCore.js), live during placement sessions.
  // Controls live in React; the session reads them through a ref so
  // mid-stroke slider changes don't rebuild anything.
  const eraseSessionRef = useRef(null)
  const eraseControlsRef = useRef(null)
  const [eraseControls, setEraseControls] = useState({ mode: 'arrange', size: 40, hardness: 'soft' })
  const [eraseHistory, setEraseHistory] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    eraseControlsRef.current = eraseControls
    eraseSessionRef.current?.setActive(eraseControls.mode === 'erase')
  }, [eraseControls])

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
  // needed, Editor asks the backend for a random sample and reports it back
  // via SET_GRID. Falls back to sampling the already-loaded full listing if
  // the endpoint fails.
  useEffect(() => {
    if (state.phase !== 'OPENING_PICK' || state.grid.length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/images/sample?n=${state.rolls.gridSize}`)
        const data = await res.json()
        if (!cancelled && data.ok && data.filenames.length > 0) {
          dispatch({ type: 'SET_GRID', filenames: data.filenames })
          return
        }
      } catch {
        // fall through to the client-side fallback
      }
      if (cancelled || imageList.status !== 'ready' || imageList.filenames.length === 0) return
      const pool = [...imageList.filenames]
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      dispatch({ type: 'SET_GRID', filenames: pool.slice(0, Math.min(state.rolls.gridSize, pool.length)) })
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
    setEraseControls({ mode: 'arrange', size: 40, hardness: 'soft' })
    setEraseHistory({ canUndo: false, canRedo: false })
    placeImages(canvas, state.toPlace, () => cancelled)
      .then((imgs) => {
        if (cancelled || imgs.length === 0) return
        eraseSessionRef.current = createEraseSession(canvas, imgs, {
          getControls: () => eraseControlsRef.current,
          onHistoryChange: (canUndo, canRedo) => setEraseHistory({ canUndo, canRedo })
        })
      })
      .catch((err) => console.warn('Placement image failed to load:', err))
      .finally(() => {
        if (!cancelled) setPlacementReady(true)
      })
    return () => {
      cancelled = true
      eraseSessionRef.current?.dispose()
      eraseSessionRef.current = null
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

    const defaults = entry.defaultControls || {}
    setCardControls(defaults)
    setCardInfo({})
    setCardReady(false)

    let cancelled = false
    ;(async () => {
      const ctx = {
        canvas,
        controls: defaults,
        imageList: imageList.filenames,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        report: (patch) => setCardInfo((prev) => ({ ...prev, ...patch }))
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
      controls: cardControls,
      session: cardSessionRef.current,
      // Overlay cards (e.g. Frame) re-render a sized offscreen layer on
      // each control change, so they need the canvas dimensions here just
      // like the begin ctx provides them. Without these the offscreen canvas
      // is 0x0 and the overlay never updates.
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
      // Cmd/Ctrl+Z (+Shift for redo): within-card brush undo during
      // placement sessions. Never crosses an End.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        if (state.phase === 'PLACEMENT' || state.phase === 'STASH_RETURN') {
          e.preventDefault()
          if (e.shiftKey) eraseSessionRef.current?.redo()
          else eraseSessionRef.current?.undo()
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
  }, [state.currentCard, state.phase, cardReady, placementReady, imageList])

  function handleControlChange(key, value) {
    setCardControls((prev) => ({ ...prev, [key]: value }))
  }

  // End of a card round: the card's own commit hook finalizes its temp
  // objects, then the UNIVERSAL BAKE flattens the whole canvas into the
  // master. No card implements flattening; this is the v2 commitment step.
  function handleCommit() {
    if (!state.currentCard) return
    const entry = cardRegistry[state.currentCard.id]
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) {
      if (entry?.commit) {
        entry.commit({
          canvas,
          controls: cardControls,
          session: cardSessionRef.current
        })
      }
      masterRef.current = bake(canvas)
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
    dispatch({ type: 'COMMIT' })
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
        </section>
        <aside className="side-stack">
          <DeckPanel
            state={state}
            imageList={imageList}
            entry={currentEntry}
            controls={cardControls}
            info={cardInfo}
            ready={cardReady}
            placementReady={placementReady}
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
