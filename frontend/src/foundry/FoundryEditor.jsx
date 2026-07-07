import { useEffect, useReducer, useRef, useState } from 'react'
import * as fabric from 'fabric'
import CanvasStage from '../editor/CanvasStage.jsx'
import Card from '../editor/Card.jsx'
import { CardGridPicker } from '../editor/GridPicker.jsx'
import FoundryPanel from './FoundryPanel.jsx'
import { foundryReducer, initialFoundryState, COMMISSIONS, FOUNDRY_TUNING } from './foundryDeck.js'
import { foundryRegistry } from './foundryRegistry.jsx'
import { dealPlateOffer, fetchPlateList, mountPlate, plateUrl } from './plates.js'
import { dealPanelGrid, fetchArtSources, mountPanelArt, panelArtUrl } from './panelArt.js'
import { createMaskSession } from '../editor/brushCore.js'
import { dispatchKey } from '../editor/keymap.js'
import { arrangeBindings, brushBindings } from '../editor/sessionBindings.js'
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

  // The plates folder listing (plates.js). `status`: loading | ready | error.
  const [plateList, setPlateList] = useState({ status: 'loading', filenames: [], folder: null, error: null })
  // The mounted plate matte (a Fabric object) — consumed by the Press.
  const plateObjRef = useRef(null)
  const [plateReady, setPlateReady] = useState(false)

  // Panel-art sources: inputs + exports, tagged (panelArt.js).
  const [artSources, setArtSources] = useState({ status: 'loading', files: [], error: null })
  // The mounted panel art (under the matte) — consumed by the Press.
  const panelImgRef = useRef(null)
  const [artReady, setArtReady] = useState(true) // false only while art is in flight

  // The standing mask brush over the panel art (brushCore.js) — same
  // machinery as Deck's placement sessions. Controls live in React; the
  // session reads them through a ref so mid-stroke changes don't rebuild.
  const maskSessionRef = useRef(null)
  const maskControlsRef = useRef(null)
  const [maskControls, setMaskControls] = useState({ mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 })
  const [maskHistory, setMaskHistory] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    maskControlsRef.current = maskControls
    maskSessionRef.current?.setActive(maskControls.mode !== 'arrange')
  }, [maskControls])

  // Create the master once the Fabric canvas exists — card-face dimensions.
  useEffect(() => {
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    masterRef.current = createMaster(FACE_MASTER_WIDTH, FACE_MASTER_HEIGHT)
    showMaster(canvas, masterRef.current)
  }, [])

  // Fetch the plates folder listing and the art sources once.
  useEffect(() => {
    let cancelled = false
    fetchPlateList().then((list) => {
      if (!cancelled) setPlateList(list)
    })
    fetchArtSources().then((sources) => {
      if (!cancelled) setArtSources(sources)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The reducer never touches the filesystem: when the plate offer is
  // needed, deal it from the folder listing and report back (SET_GRID's
  // pattern, deck.js).
  useEffect(() => {
    if (state.phase !== 'PLATE_DEAL' || state.plateOffer.length > 0) return
    if (plateList.status !== 'ready') return
    dispatch({
      type: 'SET_PLATE_OFFER',
      plates: dealPlateOffer(plateList.filenames, FOUNDRY_TUNING.plateDeal)
    })
  }, [state.phase, state.plateOffer.length, plateList])

  // Deal the panel grid when the pick opens (SET_GRID's pattern again).
  useEffect(() => {
    if (state.phase !== 'PANEL_PICK' || state.panelGrid.length > 0) return
    if (artSources.status !== 'ready') return
    dispatch({
      type: 'SET_PANEL_GRID',
      files: dealPanelGrid(artSources.files, FOUNDRY_TUNING.panelGrid)
    })
  }, [state.phase, state.panelGrid.length, artSources])

  // The picked art mounts UNDER the plate matte and gets the mask brush —
  // the window crops it live. Cleanup covers re-pick (REPICK_PANEL) and
  // restarts, including mid-flight loads.
  useEffect(() => {
    if (!state.panelArt) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    setArtReady(false)
    setMaskControls({ mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 })
    setMaskHistory({ canUndo: false, canRedo: false })
    mountPanelArt(canvas, state.panelArt)
      .then((img) => {
        if (cancelled) {
          canvas.remove(img)
          return
        }
        panelImgRef.current = img
        maskSessionRef.current = createMaskSession(canvas, [img], {
          getControls: () => maskControlsRef.current,
          onHistoryChange: (canUndo, canRedo) => setMaskHistory({ canUndo, canRedo }),
          onSizeChange: (size) => setMaskControls((prev) => ({ ...prev, size }))
        })
        setArtReady(true)
      })
      .catch((err) => console.warn('Panel art failed to load:', err))
      .finally(() => {
        if (!cancelled) setArtReady(true)
      })
    return () => {
      cancelled = true
      maskSessionRef.current?.dispose()
      maskSessionRef.current = null
      if (panelImgRef.current) {
        canvas.remove(panelImgRef.current)
        canvas.requestRenderAll()
        panelImgRef.current = null
      }
      setArtReady(true)
    }
  }, [state.panelArt])

  // The taken plate mounts as the matte on top (card_maker.md §3.5) and
  // stays live until the Press seals it. Fires exactly when `plate` is
  // taken (and cleans up if a restart lands while the PNG is in flight).
  useEffect(() => {
    if (!state.plate) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    setPlateReady(false)
    mountPlate(canvas, state.plate.file)
      .then((obj) => {
        if (cancelled) {
          canvas.remove(obj)
          return
        }
        plateObjRef.current = obj
        setPlateReady(true)
      })
      .catch((err) => console.warn('Plate failed to load:', err))
    return () => {
      cancelled = true
      plateObjRef.current = null
      setPlateReady(false)
    }
  }, [state.plate])

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
  // master in one commit (card_maker.md §3.5). The bake consumes the live
  // objects; the refs and the mask session die with them (a brush left in
  // Erase must not survive into the graffiti rounds).
  function handlePress() {
    const canvas = canvasStageRef.current?.getCanvas()
    maskSessionRef.current?.dispose()
    maskSessionRef.current = null
    setMaskControls((prev) => ({ ...prev, mode: 'arrange' }))
    if (canvas) masterRef.current = bake(canvas)
    plateObjRef.current = null
    panelImgRef.current = null
    dispatch({ type: 'PRESS' })
  }

  function handleRestart() {
    if (committingRef.current) return
    const canvas = canvasStageRef.current?.getCanvas()
    maskSessionRef.current?.dispose()
    maskSessionRef.current = null
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
    plateObjRef.current = null
    panelImgRef.current = null
    setMaskControls({ mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 })
    setMaskHistory({ canUndo: false, canRedo: false })
    setCardControls({})
    setCardInfo({})
    setExportState({ status: 'idle', savedPath: null, error: null, thumbDataUrl: null })
    dispatch({ type: 'RESTART' })
  }

  // Point the plates deck at a different folder (native picker → persist →
  // refetch). Offered from the plate deal when the folder is missing/empty.
  async function handleChoosePlatesFolder() {
    try {
      const picked = await fetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'read', current: plateList.folder })
      }).then((r) => r.json())
      if (!picked.ok || !picked.path) return
      const saved = await fetch('/api/plates-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: picked.path })
      }).then((r) => r.json())
      if (!saved.ok) {
        setPlateList((prev) => ({ ...prev, status: 'error', error: saved.error }))
        return
      }
      setPlateList({ status: 'loading', filenames: [], folder: null, error: null })
      setPlateList(await fetchPlateList())
    } catch (err) {
      setPlateList((prev) => ({ ...prev, status: 'error', error: err.message }))
    }
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

  const getCanvas = () => canvasStageRef.current?.getCanvas()
  const bindings = []
  const artInHand = !!state.panelArt && artReady

  // The brush grammar over the panel art (sessionBindings.js — the same
  // dialect as Deck's placement sessions), plus its undo/redo.
  if (state.phase === 'PANEL_PICK' && artInHand) {
    bindings.push(
      ...brushBindings(
        () => maskControls,
        (patch) => setMaskControls((prev) => ({ ...prev, ...patch })),
        { canArrange: true, hasMode: true, hasHardness: true }
      ),
      { key: 'z', mod: true, shift: false, run: () => maskSessionRef.current?.undo() },
      { key: 'z', mod: true, shift: true, run: () => maskSessionRef.current?.redo() }
    )
  }
  // Arrange keys wherever the foundation is live and arrangeable: the art
  // under the window (while the brush is in arrange), and TYPE_SETTING —
  // "nudge everything" holds until the Press.
  const arranging =
    (state.phase === 'PANEL_PICK' && artInHand && maskControls.mode === 'arrange') ||
    state.phase === 'TYPE_SETTING'
  if (arranging) bindings.push(...arrangeBindings(getCanvas))

  if (state.phase === 'WORKING' && !state.currentCard) {
    bindings.push(
      { code: 'Space', run: () => dispatch({ type: 'DEAL' }) },
      { key: 'Enter', run: () => dispatch({ type: 'DEAL' }) }
    )
  } else if (state.phase === 'WORKING' && cardReady && !committing) {
    bindings.push({ key: 'Enter', run: handleCommit })
  } else if (state.phase === 'PANEL_PICK' && plateReady && artInHand) {
    // Before the pick, the grid overlay owns Enter (CardGridPicker's own
    // listener confirms the taken image); artless Continue stays click-only.
    bindings.push({ key: 'Enter', run: () => dispatch({ type: 'END_PANEL' }) })
  } else if (state.phase === 'COMPLETE') {
    bindings.push({ key: 'Enter', run: handleRestart })
  }
  // The Press is deliberately click-only — sealing the foundation should
  // never be a double-press accident (the CodaChoice rule).
  bindings.push(
    { key: 'r', shift: true, run: handleRestart },
    {
      key: 'Escape', // back out of a selection; never ends or commits
      run: () => {
        const canvas = getCanvas()
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
              plateList={plateList}
              onTake={(plateId) => dispatch({ type: 'TAKE_PLATE', plateId })}
              onChooseFolder={handleChoosePlatesFolder}
            />
          )}
          {state.phase === 'PANEL_PICK' && !state.panelArt && (
            <CardGridPicker
              title="THE PANEL"
              hint="Take an image for the window — your finished pieces and raw inputs, dealt together. It lands under the plate; the window crops it."
              files={state.panelGrid}
              fileUrl={panelArtUrl}
              confirmLabel="Take — place under the window"
              onConfirm={(file) => dispatch({ type: 'PICK_PANEL', file })}
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
            plateReady={plateReady}
            artReady={artReady}
            maskControls={maskControls}
            maskHistory={maskHistory}
            onMaskControlsChange={(patch) => setMaskControls((prev) => ({ ...prev, ...patch }))}
            onMaskUndo={() => maskSessionRef.current?.undo()}
            onMaskRedo={() => maskSessionRef.current?.redo()}
            onRepick={() => dispatch({ type: 'REPICK_PANEL' })}
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

// The plate deal: real plates from the plates folder, dealt face up. The
// transparent window renders over white here — exactly what the empty
// master will show through it.
function PlateDeal({ plates, plateList, onTake, onChooseFolder }) {
  return (
    <div className="grid-picker">
      <h2>THE PLATE</h2>
      {plateList.status === 'loading' && <p className="hint">Reading the plates folder…</p>}
      {plateList.status === 'error' && (
        <>
          <p className="error">{plateList.error}</p>
          {plateList.folder && <p className="hint mono">{plateList.folder}</p>}
          <div>
            <button type="button" className="secondary" onClick={onChooseFolder}>
              Choose plates folder
            </button>
          </div>
        </>
      )}
      {plateList.status === 'ready' && (
        <>
          <p className="hint">
            {plates.length} plate{plates.length === 1 ? '' : 's'} dealt — take
            one. Its frame is the card&apos;s convention layer; the white
            window is the punched image panel, waiting for art.
          </p>
          <div className="foundry-plate-row">
            {plates.map((p) => (
              <button
                key={p.id}
                type="button"
                className="foundry-plate"
                onClick={() => onTake(p.id)}
                title="Take this plate"
              >
                <img src={plateUrl(p.file)} alt="A blank plate" draggable={false} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default FoundryEditor
