// canvasNav.js — Photoshop/PureRef-style free camera over the pasteboard.
//
// Deck's Fabric buffer is the whole workspace; the artboard (the 800×1000
// document a card sees) is a rectangle anchored at scene (0,0)→(800,1000),
// floating in a gray void. This module is the *camera*: it moves ONLY the
// canvas's viewportTransform — panning and zooming the view over that fixed
// artboard. The master, the bake, and the export are untouched: the camera is
// a lens on the same pixels, not a change to them. We move the view, never the
// artboard (exactly as Photoshop does).
//
// Two gestures, both borrowed from image editors (hotkeys.md §1.3):
//   • Hold Space + drag = pan (grab the view and slide the artboard anywhere).
//   • Ctrl/Cmd + scroll wheel = zoom toward the cursor.
// Plain scroll does nothing (the page never scrolls here); the wheel is only
// prevented from its default when the zoom modifier is held.
//
// reset() is fit-and-center: it scales the artboard to fit the current buffer
// with a margin and centers it. Editor calls it on the `0` key and on every
// deal/End/phase change, and should also call it when the buffer resizes — so
// "reset" is the single re-fit entry point regardless of what changed.
//
// attachCanvasNav wires these to a given Fabric canvas and returns
// { reset, dispose, setEnabled }. Editor owns one instance for the whole
// session and disables it while a card owns the viewport itself (Etch), so the
// two navigators can never fight and leave a leaked transform — the bake resets
// the viewport regardless, but suspending nav keeps the gestures from
// interfering with the card's own zoom mid-session.

// The artboard is what a card sees: the fixed 800×1000 document rect at scene
// origin. These are the shared artboard dims (one definition, CanvasStage); the
// buffer is the whole workspace, read live from the canvas.
import { ARTBOARD_WIDTH, ARTBOARD_HEIGHT } from './CanvasStage.jsx'

// Zoom bounds. Min is low so the artboard can shrink to a card-sized rectangle
// in a big void; the soft clamp (not the min) is what keeps it from vanishing.
const ZOOM_MIN = 0.1
const ZOOM_MAX = 8
const ZOOM_STEP = 0.0018 // wheel delta → zoom factor; tuned for a trackpad

// Fit-and-center leaves a breath of void around the artboard so it reads as a
// floating page, not an edge-to-edge fill.
const FIT_MARGIN = 0.9

// The soft clamp keeps at least this many *artboard* pixels (screen-space) on
// each edge, so the artboard can roam to either side or fill the view but can
// never be dragged fully out of sight. A tuning number — iterate in-browser.
const KEEP_VISIBLE = 96

// While Space is held, canvasNav flags the canvas so the other pointer
// consumers (brushCore, etch, lift) stand down — a pan-drag must never also
// paint or move an object. They read this instead of importing canvasNav's
// internals; one shared, explicit convention.
export function isPanning(canvas) {
  return !!canvas.__navPanArmed
}

// The fit-and-center transform: scale the artboard to fit the current buffer
// (with FIT_MARGIN) and center it. The artboard sits at scene (0,0), so its
// top-left maps to (tx, ty) and the whole rect lands centered in the buffer.
function fitTransform(canvas) {
  const bw = canvas.getWidth()
  const bh = canvas.getHeight()
  const zoom = Math.min(bw / ARTBOARD_WIDTH, bh / ARTBOARD_HEIGHT) * FIT_MARGIN
  const tx = (bw - ARTBOARD_WIDTH * zoom) / 2
  const ty = (bh - ARTBOARD_HEIGHT * zoom) / 2
  return [zoom, 0, 0, zoom, tx, ty]
}

export function attachCanvasNav(canvas, { onZoomChange } = {}) {
  let enabled = true
  let spaceDown = false // Space held → pan-hold armed
  let panning = false // a pan drag is in progress
  let lastClient = null // last pointer position (client coords) during a pan

  // Space suspends Fabric's own selection/target-finding so a pan-drag never
  // grabs an object; we snapshot the real values to restore on release. A card
  // (Etch) may set skipTargetFind itself — restoring our snapshot is correct
  // because nav is disabled while such a card owns the viewport.
  let saved = null
  const armPan = () => {
    if (saved) return
    saved = { selection: canvas.selection, skipTargetFind: canvas.skipTargetFind }
    canvas.__navPanArmed = true // signal the other pointer consumers to stand down
    canvas.selection = false
    canvas.skipTargetFind = true
    canvas.discardActiveObject()
    canvas.defaultCursor = 'grab'
    canvas.setCursor('grab')
    canvas.requestRenderAll()
  }
  const disarmPan = () => {
    if (!saved) return
    canvas.__navPanArmed = false
    canvas.selection = saved.selection
    canvas.skipTargetFind = saved.skipTargetFind
    canvas.defaultCursor = 'default'
    canvas.setCursor('default')
    saved = null
    panning = false
    lastClient = null
    canvas.requestRenderAll()
  }

  // --- zoom: Ctrl/Cmd + wheel, toward the cursor ---
  const onWheel = (opt) => {
    if (!enabled) return
    const e = opt.e
    if (!(e.ctrlKey || e.metaKey)) return // plain scroll does nothing
    e.preventDefault()
    e.stopPropagation()
    let zoom = canvas.getZoom() * (1 - e.deltaY * ZOOM_STEP)
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
    // zoomToPoint keeps the given *viewport* (screen) point fixed while it
    // rescales — verified against Fabric 6.9.1 (it inverts the vpt internally),
    // so the cursor's screen position is getViewportPoint(e), not getScenePoint.
    canvas.zoomToPoint(canvas.getViewportPoint(e), zoom)
    clampPan()
    onZoomChange?.(zoom)
  }

  // --- pan: Space held + drag ---
  const onMouseDown = (opt) => {
    if (!enabled || !spaceDown) return
    panning = true
    lastClient = { x: opt.e.clientX, y: opt.e.clientY }
    canvas.setCursor('grabbing')
  }
  const onMouseMove = (opt) => {
    if (!panning) return
    const e = opt.e
    const vpt = canvas.viewportTransform.slice()
    vpt[4] += e.clientX - lastClient.x
    vpt[5] += e.clientY - lastClient.y
    lastClient = { x: e.clientX, y: e.clientY }
    canvas.setViewportTransform(vpt)
    clampPan()
    canvas.setCursor('grabbing')
  }
  const onMouseUp = () => {
    if (!panning) return
    panning = false
    lastClient = null
    if (spaceDown) canvas.setCursor('grab')
  }

  // Soft clamp: unlike the old hard clamp (which pinned the artboard's edges to
  // the buffer), the pasteboard lets the artboard roam freely — to either side,
  // or filling the screen when zoomed in — but never fully off-view. We keep at
  // least KEEP_VISIBLE screen-pixels of the artboard on each axis. The artboard
  // occupies scene (0,0)→(ARTBOARD), so on screen it spans
  // [vpt[4], vpt[4] + ARTBOARD_WIDTH*zoom] × [vpt[5], vpt[5] + ARTBOARD_HEIGHT*zoom].
  const clampPan = () => {
    const vpt = canvas.viewportTransform.slice()
    const zoom = canvas.getZoom()
    const bw = canvas.getWidth()
    const bh = canvas.getHeight()
    const spanX = ARTBOARD_WIDTH * zoom
    const spanY = ARTBOARD_HEIGHT * zoom
    // vpt[4] in [KEEP - spanX, bw - KEEP]: the right edge stays ≥ KEEP from the
    // left wall, and the left edge stays ≥ KEEP from the right wall.
    vpt[4] = Math.min(bw - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - spanX, vpt[4]))
    vpt[5] = Math.min(bh - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - spanY, vpt[5]))
    canvas.setViewportTransform(vpt)
  }

  // Space is a raw window listener (not the keymap): the keymap is keydown
  // only, and pan-hold needs the matching keyup. Repeat events are ignored so
  // holding Space arms exactly once. Form fields keep their Space (typing).
  const isFormTarget = (t) =>
    t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
  const onKeyDown = (e) => {
    if (e.code !== 'Space' || e.repeat || !enabled) return
    if (isFormTarget(e.target)) return
    e.preventDefault() // Space no longer deals; here it must not scroll either
    spaceDown = true
    armPan()
  }
  const onKeyUp = (e) => {
    if (e.code !== 'Space') return
    spaceDown = false
    disarmPan()
  }

  canvas.on('mouse:wheel', onWheel)
  canvas.on('mouse:down', onMouseDown)
  canvas.on('mouse:move', onMouseMove)
  canvas.on('mouse:up', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // Fit-and-center the artboard in the current buffer. This is the `0` key, the
  // auto-reset on every deal/End/phase change, and the re-fit on buffer resize.
  const reset = () => {
    canvas.setViewportTransform(fitTransform(canvas))
    canvas.requestRenderAll()
    onZoomChange?.(canvas.getZoom())
  }

  return {
    reset,
    // Suspend/resume: while a card owns the viewport (Etch), nav steps aside.
    // Disabling ends any in-progress pan and drops the Space arm so the card
    // sees a clean canvas.
    setEnabled: (v) => {
      enabled = v
      if (!v) {
        spaceDown = false
        disarmPan()
      }
    },
    dispose: () => {
      canvas.off('mouse:wheel', onWheel)
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      disarmPan()
    }
  }
}
