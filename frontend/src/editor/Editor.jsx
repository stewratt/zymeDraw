import { useEffect, useReducer, useRef, useState } from 'react'
import CanvasStage, { CANVAS_WIDTH, CANVAS_HEIGHT } from './CanvasStage.jsx'
import DeckPanel from './DeckPanel.jsx'
import LayersPanel from './LayersPanel.jsx'
import { deckReducer, initialState } from './deck.js'
import { cardRegistry } from './cards/registry.jsx'
import { getCommittedLayers } from './layers.js'
import './editor.css'

// Editor is a generic dispatcher. It doesn't know what any card does — it
// looks up the current card in cardRegistry and calls
// begin/update/commit/cleanup at the right times. The session arc itself
// (rolls → pick → placement → acts → Coda) lives in deck.js; Editor's only
// arc-specific job is the impure work the reducer can't do: sampling the
// opening grid from the image list and exporting on COMPLETE.
function Editor({ config, onBackToSetup }) {
  const [state, dispatch] = useReducer(deckReducer, undefined, initialState)

  const canvasStageRef = useRef(null)
  const cardSessionRef = useRef(null) // opaque per-card data the registry owns

  // Per-card UI state: controls (slider values etc.), info (data the Tools
  // component renders), ready (true once begin has finished).
  const [cardControls, setCardControls] = useState({})
  const [cardInfo, setCardInfo] = useState({})
  const [cardReady, setCardReady] = useState(true)

  // The current layer list (committed Fabric objects with deckId).
  const [committedLayers, setCommittedLayers] = useState([])

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
  // needed, Editor samples filenames and reports them back via SET_GRID.
  // Phase 1 samples client-side from the full listing; Phase 3 swaps this
  // for the backend's /api/images/sample endpoint.
  useEffect(() => {
    if (state.phase !== 'OPENING_PICK' || state.grid.length > 0) return
    if (imageList.status !== 'ready' || imageList.filenames.length === 0) return
    const pool = [...imageList.filenames]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const n = Math.min(state.rolls.gridSize, pool.length)
    dispatch({ type: 'SET_GRID', filenames: pool.slice(0, n) })
  }, [state.phase, state.grid.length, state.rolls, imageList])

  // After each commit, refresh the canvas-layer list so the Layers panel
  // sees newly-tagged objects. Also refresh when a card becomes ready: a
  // card's begin() can place tagged objects (e.g. Add card images) that the
  // panel must see *during* the card, not just after commit. This is generic
  // — getCommittedLayers filters by deckId, so untagged temp objects are
  // ignored regardless of which card is running.
  useEffect(() => {
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    setCommittedLayers(getCommittedLayers(canvas))
  }, [state.history.length, cardReady])

  // When a death card is dealt (phase → COMPLETE), render the canvas at 3×
  // (→ 2400×3000 for the 800×1000 working canvas) and POST to the backend so
  // it writes the PNG into the configured output folder. Runs exactly once
  // per transition. (Phase 2 replaces the 3× multiplier with the master
  // raster.)
  useEffect(() => {
    if (state.phase !== 'COMPLETE') return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    setExportState({ status: 'exporting', savedPath: null, error: null, thumbDataUrl: null })
    ;(async () => {
      try {
        // Force a render flush so filter pipelines have populated each
        // image's cache before we snapshot.
        canvas.renderAll()
        const pngBase64 = canvas.toDataURL({ multiplier: 3 })
        // A tiny thumbnail for the FINISHED screen. ~320×400 — cheap.
        const thumbDataUrl = canvas.toDataURL({ multiplier: 0.4 })
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
      // Placeholder cards (eraser/flatten/etc. before their checkpoints):
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
        layers: getCommittedLayers(canvas),
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
        } else if (state.phase === 'PLACEMENT' || state.phase === 'STASH_RETURN') {
          e.preventDefault()
          dispatch({ type: 'END_PLACEMENT' })
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
  }, [state.currentCard, state.phase, cardReady, imageList])

  function handleControlChange(key, value) {
    setCardControls((prev) => ({ ...prev, [key]: value }))
  }

  function handleCommit() {
    if (!state.currentCard) return
    const entry = cardRegistry[state.currentCard.id]
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas && entry?.commit) {
      entry.commit({
        canvas,
        controls: cardControls,
        session: cardSessionRef.current,
        layers: committedLayers
      })
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
    dispatch({ type: 'COMMIT' })
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
      canvas.requestRenderAll()
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
    setCommittedLayers([])
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
  const showLayersPanel = !!currentEntry?.needsLayersPanel && !!state.currentCard

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
        </section>
        <aside className="side-stack">
          <DeckPanel
            state={state}
            imageList={imageList}
            entry={currentEntry}
            controls={cardControls}
            info={cardInfo}
            ready={cardReady}
            exportState={exportState}
            onControlChange={handleControlChange}
            onRoll={() => dispatch({ type: 'ROLL_OPENING' })}
            onConfirmPick={(placed, stashed) => dispatch({ type: 'CONFIRM_PICK', placed, stashed })}
            onEndPlacement={() => dispatch({ type: 'END_PLACEMENT' })}
            onDeal={() => dispatch({ type: 'DEAL' })}
            onCommit={handleCommit}
            onRestart={handleRestart}
            onOpenOutput={handleOpenOutput}
          />
          {showLayersPanel && (
            <LayersPanel
              mode={currentEntry.layersPanelMode}
              layers={
                currentEntry.layerKinds
                  ? committedLayers.filter((l) => currentEntry.layerKinds.includes(l.kind))
                  : committedLayers
              }
              controls={cardControls}
              onControlChange={handleControlChange}
            />
          )}
        </aside>
      </main>
    </div>
  )
}

export default Editor
