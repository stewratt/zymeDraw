// The pocket session — the mobile shell's orchestrator.
//
// This is Editor.jsx's job on a phone: the impure half of the arc that the
// pure reducer can't do — sampling the opening grid, running each card's
// begin/update/commit/cleanup, the UNIVERSAL BAKE after every commit, and the
// export at the Coda. The rulebook itself is deck.js, unchanged and shared;
// the cards are the shared registry, unchanged and shared. What is duplicated
// here is the WIRING, deliberately (mobile_plan.md §8 Q6, decided: the mobile
// shell owns its orchestration so the desktop's most central file is never
// touched for a phone's sake). The dropped parts are dropped on purpose:
//
//   no keymap (a phone has no keyboard, so a card's HOTKEY ACCENTS are simply
//   absent — Gwarp's G and Esc are the only ones an enabled card loses; every
//   other accent has a button in its own Tools) · no deck overlay, no state
//   plinth, no card zoom · no ground picker, no layer restacking, no stash tone.
//
// Wave 4 closed the rest: the shell now honors the WHOLE registry contract —
// `postCommitReview` (Closer), `Overlay` + `deckActions` (Searcher), `dockCard`
// (Skim), `randomize`, async begin/commit — plus the CODA_CHOICE phase Delay
// opens. Every one of them is read off the registry or the reducer; there is
// still no per-card branch anywhere in this file.
//
// Everything else is the same sequence in the same order, because the
// contract is the same: a card's commit hook, then the bake, then COMMIT and
// DEAL together in one dispatch pair so the round that ends and the card that
// turns over land in a single render.
//
// The screen is three zones: the canvas (with the full-screen overlays a card
// or a phase puts over it), the tools sheet, and the deck dock at the thumb.
// The deck is still the button — one tap commits what is in hand and deals.

import { useEffect, useReducer, useRef, useState } from 'react'
import CanvasStage, { CANVAS_WIDTH, CANVAS_HEIGHT } from '../editor/CanvasStage.jsx'
import GridPicker from '../editor/GridPicker.jsx'
import { StashReturnPreview } from '../editor/cards/stashReturn.jsx'
import {
  TUNING,
  deckReducer,
  findableCounts,
  initialState,
  progressLabel,
  remainingCounts
} from '../editor/deck.js'
import { cardRegistry } from '../editor/cards/registry.jsx'
import { placeImages } from '../editor/placement.js'
import { listImages, sampleImages } from '../editor/imageStore.js'
import { exportMaster } from '../editor/exportSink.js'
import { createMaskSession } from '../editor/brushCore.js'
import { attachCanvasNav } from '../editor/canvasNav.js'
import { attachCanvasNavTouch } from '../editor/canvasNavTouch.js'
import { attachArtboardMatte } from '../editor/artboardMatte.js'
import { randomizeColors } from '../editor/colorSeed.js'
import { bake, createMaster, masterThumbDataUrl, showMaster } from '../editor/masterRaster.js'
import { UI } from '../copy/uiText.js'
import { mobileDeckSpec } from './mobileDeck.js'
import MobileCodaChoice from './MobileCodaChoice.jsx'
import MobileDock from './MobileDock.jsx'
import MobileFinish from './MobileFinish.jsx'
import MobileTools from './MobileTools.jsx'

const T = UI.deckPanel
const M = UI.mobile

const MASK_DEFAULTS = { mode: 'arrange', size: 40, hardness: 'soft', softness: 0.5, strength: 1 }

function MobileSession({ onBackToIntake }) {
  // The spec is read once, here, and rides state.deckSpec so RESTART rebuilds
  // the same deck (mobileDeck.js — the house deck, or a dev-only ?deck= for
  // walking one card on purpose).
  const [state, dispatch] = useReducer(deckReducer, mobileDeckSpec(), initialState)

  const canvasStageRef = useRef(null)
  const cardSessionRef = useRef(null) // opaque per-card data the registry owns
  const masterRef = useRef(null) // the full-resolution truth (2400×3000)
  const navRef = useRef(null) // canvasNav — the fit, and the camera the touch grammar drives
  const touchNavRef = useRef(null) // canvasNavTouch — two fingers: camera or object
  const matteRef = useRef(null) // artboardMatte: the crop edge, screen-only
  const canvasAreaRef = useRef(null) // the canvas zone; its box drives the re-fit

  const [cardControls, setCardControls] = useState({})
  const [cardInfo, setCardInfo] = useState({})
  const [cardReady, setCardReady] = useState(true)

  // The post-commit review (registry `postCommitReview`, issue #128): the card
  // commits on the deck tap like any other, and then the round HOLDS OPEN on
  // its result — the deck goes inert and a labelled button floats over the
  // canvas, and THAT is what deals. Holding the card object rather than a
  // boolean means it resets itself the moment the next card turns over: the
  // reducer hands out a distinct object per deal.
  const [reviewCard, setReviewCard] = useState(null)
  const inReview = !!state.currentCard && reviewCard === state.currentCard

  // The piece as it last committed, small, for the one overlay that needs to
  // show it (Searcher covers the canvas, so the work stands beside the choice).
  // The desktop reads this off its full-res state cache; the pocket version has
  // no plinth to feed, so a thumbnail is the whole of it.
  const [workUrl, setWorkUrl] = useState(null)

  const [placementReady, setPlacementReady] = useState(true)

  // The standing mask brush, live during placement sessions. Controls live in
  // React; the session reads them through a ref so a mid-stroke change to a
  // slider rebuilds nothing.
  const maskSessionRef = useRef(null)
  const maskControlsRef = useRef(null)
  const [maskControls, setMaskControls] = useState(MASK_DEFAULTS)
  const [maskHistory, setMaskHistory] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    maskControlsRef.current = maskControls
    maskSessionRef.current?.setActive(maskControls.mode !== 'arrange')
  }, [maskControls])

  const committingRef = useRef(false)
  const [committing, setCommitting] = useState(false)

  const [exportState, setExportState] = useState({ status: 'idle', via: null, blobUrl: null, error: null, thumbDataUrl: null })

  // The arc's two hinges (issue #119), read off deck state the reducer
  // already keeps: Act I ends, and later the Coda joins the deck. One passing
  // line above the dock; the next draw clears it.
  const [dockNotice, setDockNotice] = useState(null)
  const arcRef = useRef({ roundsDealt: state.roundsDealt, deathShuffled: state.deathShuffled })
  useEffect(() => {
    const prev = arcRef.current
    arcRef.current = { roundsDealt: state.roundsDealt, deathShuffled: state.deathShuffled }
    if (!prev.deathShuffled && state.deathShuffled) setDockNotice(T.codaInDeck)
    else if (prev.roundsDealt < TUNING.actOneRounds && state.roundsDealt >= TUNING.actOneRounds) {
      setDockNotice(T.actTwoBegins)
    }
  }, [state.roundsDealt, state.deathShuffled])

  const [imageList, setImageList] = useState({ status: 'loading', filenames: [], error: null })

  // Read the pool once. Where it comes from is the image store's business —
  // on this shell, whichever intake legs loaded (imageSources.js).
  useEffect(() => {
    listImages()
      .then((data) => {
        if (data.ok) setImageList({ status: 'ready', filenames: data.filenames, error: null })
        else setImageList({ status: 'error', filenames: [], error: data.error })
      })
      .catch((err) => setImageList({ status: 'error', filenames: [], error: err.message }))
  }, [])

  // The reducer never fetches: when the opening grid is needed, sample the
  // pool and report it back through SET_GRID.
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

  // The master raster, the camera, and the two lenses over it.
  //
  // canvasNav supplies reset() — the fit-and-center every phase change and
  // every resize needs — and owns the viewportTransform. canvasNavTouch is the
  // phone's gestures on that same camera (two fingers pan/zoom, or transform
  // the image they both land on); attaching it suspends canvasNav's own
  // keyboard/wheel gestures, so the two can never fight. artboardMatte is the
  // crop edge: the artboard is a rectangle floating in the void here too, and
  // at phone size the boundary needs saying out loud. Both are screen-only —
  // they never touch an object, the master, or the bake.
  useEffect(() => {
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    masterRef.current = createMaster()
    showMaster(canvas, masterRef.current)
    navRef.current = attachCanvasNav(canvas)
    touchNavRef.current = attachCanvasNavTouch(canvas, navRef.current)
    matteRef.current = attachArtboardMatte(canvas)
    navRef.current.reset()
    // A dev-only handle on the live canvas: the on-device console and the
    // browser-driven checks both need to read the camera, and neither can
    // reach a ref. Stripped from the built bundle.
    if (import.meta.env.DEV) window.__deckCanvas = canvas
    return () => {
      touchNavRef.current?.dispose()
      touchNavRef.current = null
      matteRef.current?.dispose()
      matteRef.current = null
      navRef.current?.dispose()
      navRef.current = null
    }
  }, [])

  // Re-fit on every card change and phase transition, so no view ever leaks
  // between rounds.
  useEffect(() => {
    navRef.current?.reset()
  }, [state.currentCard, state.phase])

  // …and whenever the canvas ZONE changes size. CanvasStage's ResizeObserver
  // matches the buffer to its box; the fit has to follow it, or a rotated
  // phone (or the iOS URL bar sliding away) leaves the artboard off-center.
  // Watching the box rather than the window is what makes the tools sheet's
  // collapse re-fit too — the observer fires through the whole transition, not
  // just at its end, so the page tracks the space it is given. A frame later,
  // so the new buffer size is the one we fit against.
  useEffect(() => {
    let frame = 0
    const refit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => navRef.current?.reset())
    }
    const observer = new ResizeObserver(refit)
    if (canvasAreaRef.current) observer.observe(canvasAreaRef.current)
    window.addEventListener('orientationchange', refit)
    window.visualViewport?.addEventListener('resize', refit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('orientationchange', refit)
      window.visualViewport?.removeEventListener('resize', refit)
    }
  }, [])

  // A placement session (opening or stash return): load the chosen images as
  // free-transform objects and arm the standing mask brush over them.
  useEffect(() => {
    if (state.phase !== 'PLACEMENT' && state.phase !== 'STASH_RETURN') return
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return
    let cancelled = false
    setPlacementReady(false)
    setMaskControls(MASK_DEFAULTS)
    setMaskHistory({ canUndo: false, canRedo: false })
    placeImages(canvas, state.toPlace, () => cancelled)
      .then((imgs) => {
        if (cancelled || imgs.length === 0) return
        maskSessionRef.current = createMaskSession(canvas, imgs, {
          getControls: () => maskControlsRef.current,
          onHistoryChange: (canUndo, canRedo) => setMaskHistory({ canUndo, canRedo }),
          onSizeChange: (size) => setMaskControls((prev) => ({ ...prev, size }))
        })
      })
      .catch((err) => console.warn('Placement image failed to load:', err))
      .finally(() => {
        if (!cancelled) setPlacementReady(true)
      })
    return () => {
      cancelled = true
      maskSessionRef.current?.dispose()
      maskSessionRef.current = null
    }
  }, [state.phase])

  // BEGIN: a new card turns over — look it up, reset its controls, await its
  // begin(). The bridge between the pure reducer and the Fabric world.
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
      cardSessionRef.current = null
      setCardControls({})
      setCardInfo({})
      setCardReady(true)
      return
    }
    const canvas = canvasStageRef.current?.getCanvas()
    if (!canvas) return

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
        nav: navRef.current,
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
  }, [state.currentCard, imageList])

  // UPDATE: a control moved — let the card react.
  useEffect(() => {
    if (!state.currentCard) return
    const entry = cardRegistry[state.currentCard.id]
    if (!entry?.update || !cardReady) return
    // A card under review has no session left to update — the commit clearing
    // cardControls is what would otherwise fire this.
    if (inReview) return
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
  }, [cardControls, state.currentCard, cardReady, inReview])

  // The Coda: the master already holds the true pixels, so export is a direct
  // read. WHERE it goes is the sink's business (mobileExport.js).
  useEffect(() => {
    if (state.phase !== 'COMPLETE') return
    const master = masterRef.current
    if (!master) return
    let cancelled = false
    setExportState({ status: 'exporting', via: null, blobUrl: null, error: null, thumbDataUrl: null })
    ;(async () => {
      try {
        const thumbDataUrl = masterThumbDataUrl(master)
        const data = await exportMaster(master)
        if (cancelled) return
        if (data.ok) {
          setExportState({
            status: 'done',
            via: data.via ?? null,
            blobUrl: data.blobUrl ?? null,
            error: null,
            thumbDataUrl
          })
        } else {
          setExportState({
            status: 'error',
            via: null,
            blobUrl: null,
            error: data.error || UI.editor.exportUnknownError,
            thumbDataUrl
          })
        }
      } catch (err) {
        if (cancelled) return
        // A tainted master lands here (a folder image loaded cross-origin):
        // the piece is on screen and unsaveable, which is exactly what the
        // message must say rather than a spinner that never ends.
        setExportState({ status: 'error', via: null, blobUrl: null, error: err.message, thumbDataUrl: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.phase])

  function handleControlChange(key, value) {
    setCardControls((prev) => ({ ...prev, [key]: value }))
  }

  // The card's own commit hook, then the universal bake. No card implements
  // flattening; this is the commitment step.
  async function commitCurrentCard() {
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
            session: cardSessionRef.current,
            canvasWidth: CANVAS_WIDTH,
            canvasHeight: CANVAS_HEIGHT
          })
        }
        // Cards that never touch the canvas (Searcher, Skim, Delay) skip the
        // bake and the glance capture — nothing changed.
        if (!entry?.skipBake) {
          masterRef.current = bake(canvas)
          setWorkUrl(masterThumbDataUrl(masterRef.current))
        }
      }
    } finally {
      committingRef.current = false
      setCommitting(false)
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
  }

  // The far side of the review: the round has been committed and looked at, so
  // now it ends. COMMIT and DEAL go together exactly as they do on an ordinary
  // deck tap — the review moved WHEN this pair fires, not what it does.
  function handleReviewContinue() {
    if (committingRef.current || !inReview) return
    setReviewCard(null)
    dispatch({ type: 'COMMIT' })
    dispatch({ type: 'DEAL' })
  }

  function endPlacement() {
    if (!placementReady) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) {
      masterRef.current = bake(canvas)
      setWorkUrl(masterThumbDataUrl(masterRef.current))
    }
    dispatch({ type: 'END_PLACEMENT' })
  }

  // The deck is the button: one tap finishes what is in hand and turns the
  // next card over. Everything that advances the session funnels through
  // here, so the commit semantics can never diverge from the deal that
  // follows. Dispatches that can't legally apply are no-ops in the reducer.
  async function handleAdvance() {
    if (committingRef.current) return
    // A committed card waiting to be seen owns the round: the deck is inert
    // until Continue, so a tap can't skip past the result.
    if (inReview) return
    setDockNotice(null)
    if (state.phase === 'PLACEMENT' || state.phase === 'STASH_RETURN') {
      if (!placementReady) return
      endPlacement()
      dispatch({ type: 'DEAL' })
      return
    }
    if (state.phase !== 'WORKING') return
    if (state.currentCard) {
      if (!cardReady) return
      await commitCurrentCard()
      // A reviewing card stops the round here, mid-way: committed and baked,
      // but not dealt. The re-fit effect only runs at a deal, and the bake left
      // the viewport at identity — so re-fit by hand, or the result would be
      // looked at framed differently from every other round.
      if (cardRegistry[state.currentCard.id]?.postCommitReview) {
        setReviewCard(state.currentCard)
        navRef.current?.reset()
        return
      }
      dispatch({ type: 'COMMIT' })
    }
    dispatch({ type: 'DEAL' })
  }

  function handleRestart() {
    if (committingRef.current) return
    const canvas = canvasStageRef.current?.getCanvas()
    if (canvas) {
      if (state.currentCard) {
        cardRegistry[state.currentCard.id]?.cleanup?.({ canvas, session: cardSessionRef.current })
      }
      canvas.clear()
      canvas.backgroundColor = '#ffffff'
      masterRef.current = createMaster()
      showMaster(canvas, masterRef.current)
    }
    cardSessionRef.current = null
    setCardControls({})
    setCardInfo({})
    setReviewCard(null)
    setWorkUrl(null)
    setPlacementReady(true)
    setDockNotice(null)
    setExportState({ status: 'idle', via: null, blobUrl: null, error: null, thumbDataUrl: null })
    dispatch({ type: 'RESTART' })
  }

  const currentEntry = state.currentCard ? cardRegistry[state.currentCard.id] : null
  // A card's canvas-area overlay (the graft grids, Searcher's remains),
  // rendered generically. Never while a card is under review: the overlay
  // belongs to the session, and the session is over.
  const CardOverlay = state.phase === 'WORKING' && !inReview ? currentEntry?.Overlay : null

  // The same fenced channel the desktop gives a deck-facing card: selector
  // output only (the legibility policy stays enforced in deck.js), and a card
  // may fire only the actions its registry entry declares.
  const deckView = { remaining: remainingCounts(state), findable: findableCounts(state), skim: state.skim }
  const cardDeckActions = new Set(currentEntry?.deckActions ?? [])
  function handleDeckAction(action) {
    if (cardDeckActions.has(action.type)) dispatch(action)
  }

  // The registry's `dockCard`: the card this round turns face-up ON TOP OF THE
  // DECK (Skim). Read here and handed to the dock, exactly as DeckPanel hands
  // it to DeckDock — the canvas stays visible for the whole round.
  const topCard = state.phase === 'WORKING' && !inReview ? (currentEntry?.dockCard?.(deckView) ?? null) : null

  const inPlacement = state.phase === 'PLACEMENT' || state.phase === 'STASH_RETURN'
  const ownsScreen =
    state.phase === 'OPENING_PICK' ||
    state.phase === 'STASH_RETURN_NOTICE' ||
    state.phase === 'CODA_CHOICE' ||
    state.phase === 'COMPLETE'
  const canAdvance =
    !inReview &&
    ((inPlacement && placementReady) ||
      (state.phase === 'WORKING' && (!state.currentCard || (cardReady && !committing))))

  const dockHint = committing
    ? T.committing
    : inPlacement
      ? placementReady
        ? T.deckHintPlacement
        : T.loadingImages
      : state.phase === 'WORKING'
        ? state.currentCard
          ? inReview
            ? T.deckHintReview
            : topCard
              ? T.deckHintTurned
              : cardReady
                ? T.deckHintActive
                : T.settingUp
          : T.deckHintIdle
        : null

  return (
    <div className="m-shell">
      <div className="m-canvas" ref={canvasAreaRef}>
        <CanvasStage ref={canvasStageRef} fill />

        {state.phase === 'OPENING_PICK' && imageList.status === 'ready' && imageList.filenames.length > 0 && (
          <div className="m-overlay m-overlay--opening">
            <GridPicker
              grid={state.grid}
              onConfirm={(placed, stashed) => dispatch({ type: 'CONFIRM_PICK', placed, stashed })}
            />
          </div>
        )}

        {/* The stash, seen before it lands: a phase, not a card branch. */}
        {state.phase === 'STASH_RETURN_NOTICE' && (
          <div className="m-overlay">
            <StashReturnPreview files={state.toPlace} onAck={() => dispatch({ type: 'ACK_STASH_RETURN' })} />
          </div>
        )}

        {/* A card's own overlay (the graft grids, Searcher's remains),
            rendered generically — same fenced props the desktop passes. */}
        {CardOverlay && (
          <div className="m-overlay m-overlay--card">
            <CardOverlay
              controls={cardControls}
              info={cardInfo}
              ready={cardReady}
              onControlChange={handleControlChange}
              deckView={deckView}
              onDeckAction={handleDeckAction}
              workUrl={workUrl}
            />
          </div>
        )}

        {/* A slow commit says so where the result will appear (`waitNote`) —
            a line beside the piece, never a block. */}
        {committing && currentEntry?.postCommitReview?.waitNote && (
          <p className="canvas-wait">{currentEntry.postCommitReview.waitNote}</p>
        )}

        {/* The post-commit review: the card is committed and the canvas IS the
            result, so there is nothing to draw over it — only a way to say it
            has been seen. Tap-only, like the stash-return beat, and in the
            canvas because that is where the result is. Read from the registry:
            no card is named here. */}
        {inReview && (
          <div className="canvas-continue">
            <button type="button" className="primary" onClick={handleReviewContinue}>
              {currentEntry.postCommitReview.label}
            </button>
          </div>
        )}

        {state.phase === 'COMPLETE' && (
          <div className="m-overlay">
            <MobileFinish
              card={state.currentCard}
              exportState={exportState}
              onRestart={handleRestart}
              onBackToIntake={onBackToIntake}
            />
          </div>
        )}
      </div>

      {/* The Coda, held: Delay was committed, so the dealt Coda waits on a
          choice instead of ending the piece where it lies. It takes the tools
          sheet's and the dock's place rather than covering the canvas — the
          question is about the piece, so the piece stays in view. */}
      {state.phase === 'CODA_CHOICE' && (
        <MobileCodaChoice
          card={state.currentCard}
          onAccept={() => dispatch({ type: 'ACCEPT_CODA' })}
          onSetAside={() => {
            // The reducer is untouched — the notice is the UI's own record
            // that the right just left the dock.
            setDockNotice(T.delaySpent)
            dispatch({ type: 'DELAY_CODA' })
          }}
        />
      )}

      {/* The phases that own the whole screen — the opening pick, the stash's
          re-encounter, the finished piece — carry their own single action, so
          the tools sheet and the dock stand down rather than offer a second
          one beside it (the desktop's division: the page confirms, the panel
          only reports). The held Coda stands down the same way, from its own
          block above. */}
      {!ownsScreen && (
        <>
          <MobileTools
            phase={state.phase}
            entry={currentEntry}
            cardKey={state.currentCard}
            title={inPlacement ? T.placementTitle : (state.currentCard?.label ?? '')}
            controls={cardControls}
            info={cardInfo}
            ready={cardReady}
            reviewing={inReview}
            deckView={deckView}
            onDeckAction={handleDeckAction}
            onControlChange={handleControlChange}
            maskControls={maskControls}
            maskHistory={maskHistory}
            placementReady={placementReady}
            onMaskControlsChange={(patch) => setMaskControls((prev) => ({ ...prev, ...patch }))}
            onMaskUndo={() => maskSessionRef.current?.undo()}
            onMaskRedo={() => maskSessionRef.current?.redo()}
          />
          <MobileDock
            card={state.currentCard}
            topCard={topCard}
            deckCount={state.deck.length}
            stashCount={state.stash.length}
            progress={progressLabel(state)}
            hint={dockHint}
            notice={dockNotice}
            delayHeld={state.delayHeld}
            actionLabel={
              inReview
                ? T.deckDrawReview
                : state.currentCard || inPlacement
                  ? M.dockCommit
                  : M.dockDraw
            }
            disabled={!canAdvance}
            onDraw={handleAdvance}
            onFit={() => navRef.current?.reset()}
          />
        </>
      )}
    </div>
  )
}

export default MobileSession
