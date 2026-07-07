import { useEffect, useReducer, useRef, useState } from 'react'
import * as fabric from 'fabric'
import CanvasStage from '../editor/CanvasStage.jsx'
import Card from '../editor/Card.jsx'
import FoundryPanel from './FoundryPanel.jsx'
import { foundryReducer, initialFoundryState, COMMISSIONS } from './foundryDeck.js'
import { foundryRegistry } from './foundryRegistry.jsx'
import { dispatchKey } from '../editor/keymap.js'
import {
  bake,
  createMaster,
  masterToPngDataUrl,
  masterThumbDataUrl,
  showMaster
} from '../editor/masterRaster.js'
import '../editor/editor.css'
import './foundry.css'

// Foundry canvas geometry (card_maker.md §2): the working canvas IS the
// deliverable's size — 745×1040, the exact face Card.jsx renders — with a
// master at the same 3× scale Deck uses.
export const FACE_WIDTH = 745
export const FACE_HEIGHT = 1040
export const FACE_MASTER_WIDTH = FACE_WIDTH * 3 // 2235
export const FACE_MASTER_HEIGHT = FACE_HEIGHT * 3 // 3120

// FoundryEditor is a generic dispatcher, Deck's Editor in miniature. It
// doesn't know what any card does — foundryRegistry owns behavior; the arc
// itself lives in foundryDeck.js. Its only arc-specific jobs are the impure
// work the reducer can't do: the bake on every End, the Press's seal, and
// exporting on COMPLETE.
function FoundryEditor() {
  const [state, dispatch] = useReducer(foundryReducer, undefined, initialFoundryState)

  const canvasStageRef = useRef(null)
  const cardSessionRef = useRef(null) // opaque per-card data the registry owns
  const masterRef = useRef(null) // the full-resolution truth (masterRaster.js)

  const [cardControls, setCardControls] = useState({})
  const [cardInfo, setCardInfo] = useState({})
  const [cardReady, setCardReady] = useState(true)

  const committingRef = useRef(false)
  const [committing, setCommitting] = useState(false)

  const [exportState, setExportState] = useState({ status: 'idle', savedPath: null, error: null, thumbDataUrl: null })

  // Create the master once the Fabric canvas exists — card-face dimensions.
  useEffect(() => {
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    masterRef.current = createMaster(FACE_MASTER_WIDTH, FACE_MASTER_HEIGHT)
    showMaster(canvas, masterRef.current)
  }, [])

  // BEGIN hook: a new working card appears. Registry entries get the same
  // lifecycle as Deck's Editor; cards WITHOUT an entry are placeholders —
  // a plain scribble brush stands in for their tool until Phase 5, so every
  // hollow round still puts real pixels through the real bake.
  useEffect(() => {
    const canvas = canvasStageRef.current?.getCanvas()
    if (!state.currentCard || !canvas) {
      cardSessionRef.current = null
      setCardControls({})
      setCardInfo({})
      setCardReady(true)
      return
    }

    const entry = foundryRegistry[state.currentCard.id]
    if (!entry) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
      canvas.freeDrawingBrush.width = 6
      canvas.freeDrawingBrush.color = '#1a1a1a'
      canvas.isDrawingMode = true
      cardSessionRef.current = null
      setCardControls({})
      setCardInfo({})
      setCardReady(true)
      return () => {
        canvas.isDrawingMode = false
      }
    }

    setCardControls(entry.defaultControls ? { ...entry.defaultControls } : {})
    setCardInfo({})
    setCardReady(false)

    let cancelled = false
    ;(async () => {
      const ctx = {
        canvas,
        master: masterRef.current,
        controls: entry.defaultControls ? { ...entry.defaultControls } : {},
        canvasWidth: FACE_WIDTH,
        canvasHeight: FACE_HEIGHT,
        report: (patch) => setCardInfo((prev) => ({ ...prev, ...patch })),
        setControl: (key, value) => setCardControls((prev) => ({ ...prev, [key]: value })),
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
  }, [state.currentCard])

  // UPDATE hook, verbatim from Deck's Editor.
  useEffect(() => {
    if (!state.currentCard) return
    const entry = foundryRegistry[state.currentCard.id]
    if (!entry?.update || !cardReady) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    entry.update({
      canvas,
      master: masterRef.current,
      controls: cardControls,
      session: cardSessionRef.current,
      canvasWidth: FACE_WIDTH,
      canvasHeight: FACE_HEIGHT
    })
  }, [cardControls, state.currentCard, cardReady])

  // COMPLETE: a Proof surfaced — write the master out through the existing
  // export route. Phase 1 ships the plain full-res PNG to the output
  // folder; the casts-folder route with the 745×1040 face lands in Phase 6.
  useEffect(() => {
    if (state.phase !== 'COMPLETE') return
    const master = masterRef.current
    if (!master) return
    let cancelled = false
    setExportState({ status: 'exporting', savedPath: null, error: null, thumbDataUrl: null })
    ;(async () => {
      try {
        const pngBase64 = masterToPngDataUrl(master)
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

  function handleControlChange(key, value) {
    setCardControls((prev) => ({ ...prev, [key]: value }))
  }

  // End of a graffiti round: the card's commit hook, then the universal
  // bake. Identical law to Deck (registry.jsx header).
  async function handleCommit() {
    if (!state.currentCard || committingRef.current) return
    const entry = foundryRegistry[state.currentCard.id]
    const canvas = canvasStageRef.current?.getCanvas()
    committingRef.current = true
    setCommitting(true)
    try {
      if (canvas) {
        canvas.isDrawingMode = false
        if (entry?.commit) {
          await entry.commit({
            canvas,
            controls: cardControls,
            session: cardSessionRef.current
          })
        }
        if (!entry?.skipBake) {
          masterRef.current = bake(canvas)
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

  // The Press: seal the whole foundation — art + plate + type — into the
  // master in one commit (card_maker.md §3.5). Phase 1 has nothing live to
  // seal yet, but the code path is the real one from day one.
  function handlePress() {
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) masterRef.current = bake(canvas)
    dispatch({ type: 'PRESS' })
  }

  function handleRestart() {
    if (committingRef.current) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) {
      if (state.currentCard) {
        const entry = foundryRegistry[state.currentCard.id]
        entry?.cleanup?.({ canvas, session: cardSessionRef.current })
      }
      canvas.isDrawingMode = false
      canvas.clear()
      canvas.backgroundColor = '#ffffff'
      masterRef.current = createMaster(FACE_MASTER_WIDTH, FACE_MASTER_HEIGHT)
      showMaster(canvas, masterRef.current)
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
    setExportState({ status: 'idle', savedPath: null, error: null, thumbDataUrl: null })
    dispatch({ type: 'RESTART' })
  }

  async function handleOpenOutput() {
    try {
      await fetch('/api/open-output', { method: 'POST' })
    } catch {
      // Non-critical — the path is already on screen.
    }
  }

  const currentEntry = state.currentCard ? foundryRegistry[state.currentCard.id] : null

  // ---- keyboard (keymap.js owns matching + form-field suppression) ----
  const bindingsRef = useRef([])
  useEffect(() => {
    const onKeyDown = (e) => dispatchKey(bindingsRef.current, e)
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const bindings = []
  if (state.phase === 'WORKING' && !state.currentCard) {
    bindings.push(
      { code: 'Space', run: () => dispatch({ type: 'DEAL' }) },
      { key: 'Enter', run: () => dispatch({ type: 'DEAL' }) }
    )
  } else if (state.phase === 'WORKING' && cardReady && !committing) {
    bindings.push({ key: 'Enter', run: handleCommit })
  } else if (state.phase === 'PANEL_PICK') {
    bindings.push({ key: 'Enter', run: () => dispatch({ type: 'END_PANEL' }) })
  } else if (state.phase === 'COMPLETE') {
    bindings.push({ key: 'Enter', run: handleRestart })
  }
  // The Press is deliberately click-only — sealing the foundation should
  // never be a double-press accident (the CodaChoice rule).
  bindings.push({ key: 'r', shift: true, run: handleRestart })
  bindingsRef.current = bindings

  return (
    <div className="editor">
      <header className="editor-header">
        <a className="link" href="/">
          ← deck
        </a>
        <h1>FOUNDRY</h1>
        <div className="header-actions">
          {state.commission && (
            <span className="foundry-commission-note">
              casting <strong>{state.commission.label}</strong>
            </span>
          )}
        </div>
      </header>

      <main className="editor-main">
        <section className="canvas-area">
          <CanvasStage ref={canvasStageRef} width={FACE_WIDTH} height={FACE_HEIGHT} />
          {state.phase === 'COMMISSION' && (
            <CommissionPick
              onChoose={(cardId) => dispatch({ type: 'CHOOSE_COMMISSION', cardId })}
              onDeal={() => dispatch({ type: 'DEAL_COMMISSION' })}
            />
          )}
          {state.phase === 'PLATE_DEAL' && (
            <PlateDeal
              plates={state.plateOffer}
              onTake={(plateId) => dispatch({ type: 'TAKE_PLATE', plateId })}
            />
          )}
        </section>
        <aside className="side-stack">
          <FoundryPanel
            state={state}
            entry={currentEntry}
            controls={cardControls}
            info={cardInfo}
            ready={cardReady}
            committing={committing}
            exportState={exportState}
            onControlChange={handleControlChange}
            onEndPanel={() => dispatch({ type: 'END_PANEL' })}
            onPress={handlePress}
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

// ---- arc overlays (session structure, not card behavior) ----

// The commission grid: every real Deck design as a card tile. Rendered over
// the canvas area like the opening pick — the faces ARE the decision.
function CommissionPick({ onChoose, onDeal }) {
  return (
    <div className="grid-picker">
      <h2>THE COMMISSION</h2>
      <p className="hint">
        Every cast opens on a commission — the card this face is for. Choose
        one, or let the deck decide.
      </p>
      <div className="foundry-commission-scroll">
        <div className="deck-row">
          {COMMISSIONS.map((c) => (
            <div className="deck-cell" key={c.id}>
              <Card
                id={c.id}
                label={c.label}
                kind={c.family === 'coda' ? 'death' : 'mod'}
                size="tile"
                onClick={() => onChoose(c.id)}
                title={`Cast ${c.label}`}
              />
              <span className="deck-cell-name">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid-picker-foot">
        <button type="button" className="primary" onClick={onDeal}>
          Deal me a commission
        </button>
      </div>
    </div>
  )
}

// The plate deal. Phase-1 stubs are flat colors; Phase 2 turns this into a
// real grid pick over plate images.
function PlateDeal({ plates, onTake }) {
  return (
    <div className="grid-picker">
      <h2>THE PLATE</h2>
      <p className="hint">
        {plates.length} plates dealt — take one. Its frame becomes the
        card&apos;s convention layer. (Flat-color stubs until Phase 2.)
      </p>
      <div className="foundry-plate-row">
        {plates.map((p) => (
          <button
            key={p.id}
            type="button"
            className="foundry-plate"
            style={{ background: p.color }}
            onClick={() => onTake(p.id)}
          >
            <span className="foundry-plate-label">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FoundryEditor
