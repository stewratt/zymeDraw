// canvasNav.js — Photoshop-style zoom/pan for the working canvas.
//
// Deck's visible Fabric canvas is a scaled proxy over the master raster
// (masterRaster.js). This module lets the user work in closer or farther —
// finer detail while placing or brushing — by moving ONLY the canvas's
// viewportTransform. The master, the bake, and the export are untouched:
// the transform is a lens on the same pixels, not a change to them.
//
// Two gestures, both borrowed from image editors (hotkeys.md §1.3):
//   • Hold Space + drag = pan (grab the canvas and move it).
//   • Ctrl/Cmd + scroll wheel = zoom toward the cursor.
// Plain scroll does nothing (the page never scrolls here); the wheel is
// only prevented from its default when the zoom modifier is held.
//
// attachCanvasNav wires these to a given Fabric canvas and returns
// { reset, dispose, setEnabled }. Editor owns one instance for the whole
// session and disables it while a card owns the viewport itself (Etch), so
// the two navigators can never fight and leave a leaked transform — the bake
// resets the viewport regardless, but suspending nav keeps the gestures from
// interfering with the card's own zoom mid-session.

const ZOOM_MIN = 0.5
const ZOOM_MAX = 8
const ZOOM_STEP = 0.0018 // wheel delta → zoom factor; tuned for a trackpad

const IDENTITY = [1, 0, 0, 1, 0, 0]

// While Space is held, canvasNav flags the canvas so the other pointer
// consumers (brushCore, etch, lift) stand down — a pan-drag must never also
// paint or move an object. They read this instead of importing canvasNav's
// internals; one shared, explicit convention.
export function isPanning(canvas) {
  return !!canvas.__navPanArmed
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
    canvas.zoomToPoint(canvas.getScenePoint(e), zoom)
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

  // Keep the canvas from being panned entirely off-view: at any zoom the pan
  // offset stays within [-(scaled size - view size), 0] on each axis, so at
  // 1× the view is pinned and zoomed-in panning can't lose the piece.
  const clampPan = () => {
    const vpt = canvas.viewportTransform
    const zoom = canvas.getZoom()
    const overX = canvas.getWidth() * (zoom - 1)
    const overY = canvas.getHeight() * (zoom - 1)
    vpt[4] = Math.min(0, Math.max(-overX, vpt[4]))
    vpt[5] = Math.min(0, Math.max(-overY, vpt[5]))
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

  const reset = () => {
    canvas.setViewportTransform(IDENTITY.slice())
    canvas.requestRenderAll()
    onZoomChange?.(1)
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
