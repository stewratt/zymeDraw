import { useEffect, useReducer, useRef, useState } from 'react'
import * as fabric from 'fabric'
import CanvasStage from '../editor/CanvasStage.jsx'
import Card from '../editor/Card.jsx'
import { CardGridPicker } from '../editor/GridPicker.jsx'
import FoundryPanel from './FoundryPanel.jsx'
import { foundryReducer, initialFoundryState, COMMISSIONS, FOUNDRY_TUNING } from './foundryDeck.js'
import { foundryRegistry } from './foundryRegistry.jsx'
import { fetchPlateList, mountPlate, plateEntries, plateUrl, tintPlate } from './plates.js'
import { dealPanelGrid, fetchArtSources, mountPanelArt, panelArtUrl } from './panelArt.js'
import { dealTypeFonts, fetchFontCatalog } from './fonts.js'
import { roundCorners, roundedCopy } from './cardCorners.js'
import { applyTypeFonts, inkSlot, mountTypeLayer } from './typeLayer.js'
import { saveSlotHomes } from './slotHomes.js'
import GuideSheet, { guideSeen } from '../editor/GuideSheet.jsx'
import { createMaskSession } from '../editor/brushCore.js'
import { dispatchKey } from '../editor/keymap.js'
import { arrangeBindings, brushBindings } from '../editor/sessionBindings.js'
import { randomHexColor, randomizeColors } from '../editor/colorSeed.js'
import { UI, fmt } from '../copy/uiText.js'

const F = UI.foundry
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
function FoundryEditor({ onBackToSetup }) {
  const [state, dispatch] = useReducer(foundryReducer, undefined, initialFoundryState)

  const canvasStageRef = useRef(null)
  const cardSessionRef = useRef(null) // opaque per-card data the registry owns
  const masterRef = useRef(null) // the full-resolution truth (masterRaster.js)
  // The sealed base — the master exactly as the Press left it. Safe to keep
  // by reference: bake() never mutates a master element, it replaces it.
  // Every impression of the run restarts from a clone of this.
  const baseMasterRef = useRef(null)

  const [cardControls, setCardControls] = useState({})
  const [cardInfo, setCardInfo] = useState({})
  const [cardReady, setCardReady] = useState(true)

  const committingRef = useRef(false)
  const [committing, setCommitting] = useState(false)

  const [exportState, setExportState] = useState({ status: 'idle', savedPath: null, error: null, thumbDataUrl: null })

  // The Guide (issue #75): this wing's page opens itself on a machine's
  // first visit, then lives behind the header's guide button.
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen('foundry'))

  // The plates folder listing (plates.js). `status`: loading | ready | error.
  const [plateList, setPlateList] = useState({ status: 'loading', filenames: [], folder: null, error: null })
  // The mounted plate matte (a Fabric object) — consumed by the Press.
  const plateObjRef = useRef(null)
  const [plateReady, setPlateReady] = useState(false)
  // The plate's untinted pixel source, kept from mount time — every tint
  // draws from THIS, so hue/sat moves never compound (plates.tintPlate).
  const plateSourceRef = useRef(null)
  const [plateTint, setPlateTint] = useState({ h: 0, s: 100 })

  // Panel-art sources (panelArt.js): the tagged panel pool + the raw input
  // list the stencil cards sample.
  const [artSources, setArtSources] = useState({ status: 'loading', files: [], inputs: [], panelFolder: null, error: null })

  // The font catalog (fonts.js): committed OFL set + this machine's local
  // overlay. Loaded once; the deal draws from it at TYPE_SETTING.
  const [fontCatalog, setFontCatalog] = useState(null) // null while loading
  // The live type slots (typeLayer.js) — consumed by the Press.
  const typeSlotsRef = useRef(null)
  const [typeReady, setTypeReady] = useState(false)
  // Which type slot is selected on the canvas (for the ink control): a slot
  // key, or null — null means the ink applies to every slot at once.
  const [inkTarget, setInkTarget] = useState(null)
  // The mounted panel art (under the matte) — consumed by the Press.
  const panelImgRef = useRef(null)
  const [artReady, setArtReady] = useState(true) // false only while art is in flight

  // The image selected in the panel grid, lifted out of CardGridPicker so
  // the side panel's primary button is the one that takes it (Stew: the
  // progression button people reach for should place the pick, not skip it).
  const [panelChoice, setPanelChoice] = useState(null)

  // The standing mask brush over the panel art (brushCore.js) — same
  // machinery as Deck's placement sessions. Controls live in React; the
  // session reads them through a ref so mid-stroke changes don't rebuild.
  const maskSessionRef = useRef(null)
  const maskControlsRef = useRef(null)
  const [maskControls, setMaskControls] = useState({ mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 })
  const [maskHistory, setMaskHistory] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    maskControlsRef.current = maskControls
    // The mask brush is a PANEL_PICK tool only. Gate it on the phase so
    // crossing into TYPE_SETTING always releases the canvas — an erase left
    // mid-stroke kept skipTargetFind on and the cursor at 'none', which
    // blocked selecting/resizing the type (the brush-cursor-stuck bug).
    const active = state.phase === 'PANEL_PICK' && maskControls.mode !== 'arrange'
    maskSessionRef.current?.setActive(active)
  }, [maskControls, state.phase])

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
    fetchFontCatalog().then((catalog) => {
      if (!cancelled) setFontCatalog(catalog)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The reducer never touches the filesystem: when the plate offer is
  // needed, put the WHOLE folder on the table and report back (SET_GRID's
  // pattern, deck.js). The plate is chosen, never dealt.
  useEffect(() => {
    if (state.phase !== 'PLATE_DEAL' || state.plateOffer.length > 0) return
    if (plateList.status !== 'ready') return
    dispatch({
      type: 'SET_PLATE_OFFER',
      plates: plateEntries(plateList.filenames)
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

  // Deal the fonts when TYPE_SETTING opens (and never re-deal on re-render
  // — only N does that, through the same action).
  useEffect(() => {
    if (state.phase !== 'TYPE_SETTING' || state.typeFonts || !fontCatalog) return
    dispatch({ type: 'SET_TYPE_FONTS', fonts: dealTypeFonts(fontCatalog) })
  }, [state.phase, state.typeFonts, fontCatalog])

  // Mount the type slots when the first deal lands; on a re-deal, swap
  // faces on the LIVING objects — entered text and nudged positions
  // survive the roll (typeLayer.js).
  useEffect(() => {
    if (!state.typeFonts) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    if (typeSlotsRef.current) {
      applyTypeFonts(canvas, typeSlotsRef.current, state.typeFonts).catch((err) =>
        console.warn('Font re-deal failed to load:', err)
      )
      return
    }
    setTypeReady(false)
    mountTypeLayer(canvas, state.commission, state.typeFonts, state.plate?.file)
      .then((slots) => {
        if (cancelled) {
          canvas.remove(...Object.values(slots))
          return
        }
        typeSlotsRef.current = slots
        setTypeReady(true)
      })
      .catch((err) => console.warn('Type layer failed to mount:', err))
    return () => {
      cancelled = true
    }
  }, [state.typeFonts])

  // Track which type slot is selected while the type is live, so the ink
  // control can color one slot or all of them (typeLayer.inkSlot).
  useEffect(() => {
    if (state.phase !== 'TYPE_SETTING' || !typeReady) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    const update = () => {
      const obj = canvas.getActiveObject()
      const slots = typeSlotsRef.current
      const hit = slots && Object.entries(slots).find(([, o]) => o === obj)
      setInkTarget(hit ? hit[0] : null)
    }
    canvas.on('selection:created', update)
    canvas.on('selection:updated', update)
    canvas.on('selection:cleared', update)
    update()
    return () => {
      canvas.off('selection:created', update)
      canvas.off('selection:updated', update)
      canvas.off('selection:cleared', update)
      setInkTarget(null)
    }
  }, [state.phase, typeReady])

  // The taken plate mounts as the matte on top (card_maker.md §3.5) and
  // stays live until the Press seals it. Fires exactly when `plate` is
  // taken (and cleans up if a restart lands while the PNG is in flight).
  useEffect(() => {
    if (!state.plate) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    setPlateReady(false)
    setPlateTint({ h: 0, s: 100 })
    mountPlate(canvas, state.plate.file)
      .then((obj) => {
        if (cancelled) {
          canvas.remove(obj)
          return
        }
        plateObjRef.current = obj
        plateSourceRef.current = obj.getElement()
        setPlateReady(true)
      })
      .catch((err) => console.warn('Plate failed to load:', err))
    return () => {
      cancelled = true
      plateObjRef.current = null
      plateSourceRef.current = null
      setPlateReady(false)
    }
  }, [state.plate])

  // Live plate tint (Stew, 2026-07-07: the plate's hue/sat is adjustable on
  // every cast, all the way to the Press — foundation liveness). Draws from
  // the kept untinted source; the bake picks the tinted element up for free.
  useEffect(() => {
    const canvas = canvasStageRef.current?.getCanvas()
    const img = plateObjRef.current
    const source = plateSourceRef.current
    if (!canvas || !img || !source) return
    tintPlate(img, source, plateTint)
    canvas.requestRenderAll()
  }, [plateTint, plateReady])

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

    // Fresh defaults per deal: the color invariant first, then the card's
    // own randomize hook (Deck's Editor, verbatim).
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
        // The stencil cards sample their own source image; raw input-folder
        // filenames, exactly what Deck's Editor hands them — always the
        // main input pool, whatever the panel pick draws from.
        imageList: artSources.inputs,
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
  }, [state.currentCard, artSources])

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

  // COMPLETE: a Proof surfaced — the cast lands in the casts folder
  // (card_maker.md §1.1): the exact 745×1040 face, drop-in ready for
  // assets/cards/<id>.png, plus the full-res master alongside.
  useEffect(() => {
    if (state.phase !== 'COMPLETE') return
    const master = masterRef.current
    if (!master) return
    let cancelled = false
    setExportState({ status: 'exporting', savedPath: null, error: null, thumbDataUrl: null })
    ;(async () => {
      try {
        const faceEl = document.createElement('canvas')
        faceEl.width = FACE_WIDTH
        faceEl.height = FACE_HEIGHT
        faceEl.getContext('2d').drawImage(master, 0, 0, FACE_WIDTH, FACE_HEIGHT)
        // The corner cut (cardCorners.js): graffiti may have painted the
        // corners opaque again — the cast always ships rounded.
        roundCorners(faceEl)
        const roundedMaster = roundedCopy(master)
        const facePngBase64 = faceEl.toDataURL('image/png')
        const masterPngBase64 = masterToPngDataUrl(roundedMaster)
        const thumbDataUrl = masterThumbDataUrl(roundedMaster)
        const res = await fetch('/api/foundry/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: state.commission.id,
            impression: state.copyIndex,
            impressions: state.copiesTotal,
            facePngBase64,
            masterPngBase64
          })
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

  // Ink the type (typeLayer.inkSlot): the selected slot, or — with nothing
  // selected — every slot at once. Dark plates get light type this way.
  function handleInk(color) {
    const canvas = canvasStageRef.current?.getCanvas()
    const slots = typeSlotsRef.current
    if (!canvas || !slots) return
    const targets = inkTarget ? [slots[inkTarget]] : Object.values(slots)
    for (const obj of targets) inkSlot(obj, color)
    canvas.requestRenderAll()
  }

  // The Press: seal the whole foundation — art + plate + type — into the
  // master in one commit (card_maker.md §3.5). The bake consumes the live
  // objects; the refs and the mask session die with them (a brush left in
  // Erase must not survive into the graffiti rounds). The sealed master is
  // kept as THE BASE: every impression of the run degrades a clone of it.
  function handlePress() {
    const canvas = canvasStageRef.current?.getCanvas()
    maskSessionRef.current?.dispose()
    maskSessionRef.current = null
    setMaskControls((prev) => ({ ...prev, mode: 'arrange' }))
    if (canvas) {
      masterRef.current = bake(canvas)
      baseMasterRef.current = masterRef.current
    }
    // Train this plate's slot homes from the sealed layout (issue #43): the
    // next card on the same plate spawns where this one finished.
    saveSlotHomes(state.plate?.file, typeSlotsRef.current)
    plateObjRef.current = null
    panelImgRef.current = null
    typeSlotsRef.current = null
    setTypeReady(false)
    dispatch({ type: 'PRESS' })
  }

  // Return to the base for the next impression: the canvas restarts from a
  // CLONE of the sealed base (clone, so no card can ever reach back and
  // stain the base itself), with a fresh working deck from the reducer.
  function handleNextImpression() {
    const canvas = canvasStageRef.current?.getCanvas()
    const base = baseMasterRef.current
    if (canvas && base) {
      const clone = document.createElement('canvas')
      clone.width = base.width
      clone.height = base.height
      clone.getContext('2d').drawImage(base, 0, 0)
      masterRef.current = clone
      canvas.remove(...canvas.getObjects())
      showMaster(canvas, clone)
    }
    setExportState({ status: 'idle', savedPath: null, error: null, thumbDataUrl: null })
    dispatch({ type: 'NEXT_IMPRESSION' })
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
    plateSourceRef.current = null
    panelImgRef.current = null
    typeSlotsRef.current = null
    baseMasterRef.current = null
    setPlateTint({ h: 0, s: 100 })
    setTypeReady(false)
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

  // Point the panel pick at a dedicated art folder (native picker → persist
  // → refetch → fresh grid). Falls back to inputs + exports while unset.
  async function handleChoosePanelFolder() {
    try {
      const picked = await fetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'read', current: artSources.panelFolder })
      }).then((r) => r.json())
      if (!picked.ok || !picked.path) return
      const saved = await fetch('/api/panel-art-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: picked.path })
      }).then((r) => r.json())
      if (!saved.ok) {
        setArtSources((prev) => ({ ...prev, status: 'error', error: saved.error }))
        return
      }
      const sources = await fetchArtSources()
      setArtSources(sources)
      if (sources.status === 'ready') {
        dispatch({ type: 'SET_PANEL_GRID', files: dealPanelGrid(sources.files, FOUNDRY_TUNING.panelGrid) })
      }
    } catch (err) {
      setArtSources((prev) => ({ ...prev, status: 'error', error: err.message }))
    }
  }

  // A fresh hand from the same pool (Stew, 2026-07-07: the image choice is
  // re-shuffleable). N does the same while the grid is open.
  function handleRedealGrid() {
    if (artSources.status !== 'ready') return
    dispatch({ type: 'SET_PANEL_GRID', files: dealPanelGrid(artSources.files, FOUNDRY_TUNING.panelGrid) })
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
  const cardUp = state.phase === 'WORKING' && !!state.currentCard

  // Card accents (registry `hotkeys`) + the color re-roll — Deck's Editor,
  // verbatim.
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
              canvas: getCanvas()
            },
            e
          )
      })
    }
    if (currentEntry?.controls?.includes('color')) {
      bindings.push({
        key: 'n',
        run: () => setCardControls((prev) => ({ ...prev, color: randomHexColor() }))
      })
    }
  }

  // The brush grammar (sessionBindings.js — the same dialect as Deck):
  // over the panel art during PANEL_PICK, over the current card's controls
  // during a working round. Plus the matching undo/redo.
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
  if (cardUp) {
    bindings.push(
      { key: 'z', mod: true, shift: false, run: () => cardInfo.undo?.() },
      { key: 'z', mod: true, shift: true, run: () => cardInfo.redo?.() }
    )
  }

  // Arrange keys wherever something is live and arrangeable: the art under
  // the window (while the brush is in arrange), TYPE_SETTING ("nudge
  // everything" holds until the Press), and working cards whose mode is
  // arrange — or that have no mode at all.
  const arranging =
    (state.phase === 'PANEL_PICK' && artInHand && maskControls.mode === 'arrange') ||
    state.phase === 'TYPE_SETTING' ||
    (cardUp && (!currentEntry?.controls?.includes('mode') || cardControls.mode === 'arrange'))
  if (arranging) bindings.push(...arrangeBindings(getCanvas))

  // N re-deals the type fonts — the same accent as Deck's hue re-roll.
  // (Suppressed automatically while a text is being edited: Fabric's
  // hidden textarea is a form target.)
  if (state.phase === 'TYPE_SETTING' && fontCatalog) {
    bindings.push({
      key: 'n',
      run: () => dispatch({ type: 'SET_TYPE_FONTS', fonts: dealTypeFonts(fontCatalog) })
    })
  }

  // N while the panel grid is open: a fresh hand from the same pool.
  if (state.phase === 'PANEL_PICK' && !state.panelArt) {
    bindings.push({ key: 'n', run: handleRedealGrid })
  }

  if (state.phase === 'WORKING' && !state.currentCard) {
    bindings.push(
      { code: 'Space', run: () => dispatch({ type: 'DEAL' }) },
      { key: 'Enter', run: () => dispatch({ type: 'DEAL' }) }
    )
  } else if (state.phase === 'WORKING' && cardReady && !committing) {
    bindings.push({ key: 'Enter', run: handleCommit })
  } else if (state.phase === 'PANEL_PICK' && plateReady && artInHand) {
    // Before the pick, the grid overlay owns Enter (CardGridPicker's own
    // listener confirms the taken image); here Enter advances to the type.
    bindings.push({ key: 'Enter', run: () => dispatch({ type: 'END_PANEL' }) })
  } else if (state.phase === 'COMPLETE') {
    // Enter continues the run while impressions remain, then restarts.
    bindings.push({
      key: 'Enter',
      run: state.copyIndex < state.copiesTotal ? handleNextImpression : handleRestart
    })
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
    <div className="editor foundry">
      <header className="editor-header">
        <button type="button" className="link" onClick={onBackToSetup}>
          {UI.editor.backToSetup}
        </button>
        <h1>{F.header.title}</h1>
        <div className="header-actions">
          {state.commission && (
            <span className="foundry-commission-note">
              {F.header.casting} <strong>{state.commission.label}</strong>
              {state.copiesTotal > 1 &&
                ` ${fmt(F.header.impressionNote, { i: state.copyIndex, n: state.copiesTotal })}`}
            </span>
          )}
          <button type="button" className="link keys-button" onClick={() => setGuideOpen(true)}>
            {UI.editor.guideButton}
          </button>
        </div>
      </header>
      {guideOpen && <GuideSheet page="foundry" onClose={() => setGuideOpen(false)} />}

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
          {/* A working card's own canvas-area overlay (Stamp's grid pick),
              rendered generically — same rule as Deck's Editor. Foundry has
              no deck-facing cards, so deckView/onDeckAction stay out. */}
          {state.phase === 'WORKING' && currentEntry?.Overlay && (
            <currentEntry.Overlay
              controls={cardControls}
              info={cardInfo}
              ready={cardReady}
              onControlChange={handleControlChange}
            />
          )}
          {state.phase === 'PANEL_PICK' && !state.panelArt && (
            <CardGridPicker
              title={F.panel.title}
              hint={F.panel.gridHint}
              files={state.panelGrid}
              fileUrl={panelArtUrl}
              onChoose={setPanelChoice}
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
            plateTint={plateTint}
            onSetRunSize={(size) => dispatch({ type: 'SET_RUN_SIZE', size })}
            onPlateTint={(patch) => setPlateTint((prev) => ({ ...prev, ...patch }))}
            artReady={artReady}
            artSources={artSources}
            onRedealGrid={handleRedealGrid}
            onChoosePanelFolder={handleChoosePanelFolder}
            typeReady={typeReady}
            inkTarget={inkTarget}
            onInk={handleInk}
            onRerollFonts={() =>
              fontCatalog && dispatch({ type: 'SET_TYPE_FONTS', fonts: dealTypeFonts(fontCatalog) })
            }
            onNextImpression={handleNextImpression}
            maskControls={maskControls}
            maskHistory={maskHistory}
            onMaskControlsChange={(patch) => setMaskControls((prev) => ({ ...prev, ...patch }))}
            onMaskUndo={() => maskSessionRef.current?.undo()}
            onMaskRedo={() => maskSessionRef.current?.redo()}
            onRepick={() => dispatch({ type: 'REPICK_PANEL' })}
            panelChoice={panelChoice}
            onTakePanel={() => panelChoice && dispatch({ type: 'PICK_PANEL', file: panelChoice })}
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
// the canvas area like the opening pick — the faces ARE the decision. (The
// run size is no tile property: it's commissioned later, at the plate.)
function CommissionPick({ onChoose, onDeal }) {
  return (
    <div className="grid-picker">
      <h2>{F.commission.title}</h2>
      <p className="hint">{F.commission.pickHint}</p>
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
          {F.commission.dealButton}
        </button>
      </div>
    </div>
  )
}

// The plate pick: EVERY plate in the folder, face up — chosen, never dealt
// (Stew, 2026-07-07: certain plates for certain cards). The transparent
// window renders over white here — exactly what the empty master will show
// through it.
function PlateDeal({ plates, plateList, onTake, onChooseFolder }) {
  return (
    <div className="grid-picker">
      <h2>{F.plate.title}</h2>
      {plateList.status === 'loading' && <p className="hint">{F.plate.readingFolder}</p>}
      {plateList.status === 'error' && (
        <>
          <p className="error">{plateList.error}</p>
          {plateList.folder && <p className="hint mono">{plateList.folder}</p>}
          <div>
            <button type="button" className="secondary" onClick={onChooseFolder}>
              {F.plate.chooseFolder}
            </button>
          </div>
        </>
      )}
      {plateList.status === 'ready' && (
        <>
          <p className="hint">
            {fmt(F.plate.setHint, { count: plates.length, plural: plates.length === 1 ? '' : 's' })}
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
