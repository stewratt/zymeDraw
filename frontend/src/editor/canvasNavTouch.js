// canvasNavTouch.js — the touch grammar, over the same camera canvasNav drives.
//
// canvasNav is the desktop lens: Ctrl/Cmd+wheel zooms, Space/Ctrl+drag pans.
// This is the phone's half of the same idea, and the standard drawing-app
// grammar (mobile_plan.md §3.2):
//
//   • TWO FINGERS = the camera. Pinch zooms toward the gesture midpoint,
//     the midpoint's travel pans. Same viewportTransform, same soft clamp,
//     same zoom band — the master, the bake and the export never see it.
//   • TWO FINGERS THAT BOTH LAND ON THE PLACED IMAGE = that object instead.
//     Pinch scales it, twist rotates it, the midpoint moves it — direct
//     manipulation, because corner handles are fiddly at phone size. Fabric's
//     handles keep working exactly as they did: this is an addition.
//   • ONE FINGER stays the tool (Fabric's drag/handles, or a brush stroke).
//     A second finger landing MID-STROKE cancels that stroke rather than
//     committing it — see cancelLiveStrokes below.
//
// THE ARMING TRICK, borrowed wholesale from canvasNav's header: Fabric decides
// what a press hit before it emits its own event, so suspending selection from
// inside a handler is already too late. canvasNav arms on KEYDOWN; the touch
// equivalent is the SECOND FINGER'S touchstart, caught in the CAPTURE phase on
// the window — capture on an ancestor runs before Fabric's own target-phase
// listener on the upper canvas, so the canvas is already inert by the time
// Fabric looks at the press. From there until the surface is clear again,
// selection and target-finding stay suspended and `canvas.__navPanArmed` is
// set, which is the established convention for telling brushCore and the other
// pointer consumers to stand down (canvasNav exports isPanning() to read it).
// The arm outlives the pinch on purpose: after a two-finger gesture, the finger
// left behind must not suddenly start painting.
//
// Fabric 6.9 (verified in node_modules) tracks a `mainTouchId` and ignores
// every touch but the first, so a second finger never reaches its transform
// code — but the FIRST finger's moves keep flowing, which is exactly what the
// arm above stops. An object already mid-drag by finger one is released where
// it stands (`_currentTransform`), never reverted.
//
// The desktop shell does not attach this; the mobile shell does, and attaching
// suspends canvasNav's own gestures so the two can never fight over one camera.
//
// attachCanvasNavTouch(canvas, nav, opts) returns { dispose }.
// opts.objectGesture: `false` for camera-only, or a
// (canvas, sceneA, sceneB) → object|null resolver. Default: the topmost
// selectable object containing both touch points.

import { Point } from 'fabric'
import { ARTBOARD_WIDTH, ARTBOARD_HEIGHT } from './CanvasStage.jsx'

// ---------------------------------------------------------------------------
// FEEL NUMBERS. These are the ones to tune with real thumbs on the real phone
// (mobile_plan.md §7, Wave 3 — "tuning-heavy, expect iteration"). Nothing else
// in this file is a matter of taste; everything below this block is geometry.
// ---------------------------------------------------------------------------

// Pinch → zoom sensitivity. 1 is 1:1 with the fingers (the distance ratio is
// the zoom ratio) — the honest default. >1 makes the camera eager.
const PINCH_GAIN = 1

// The same, for a pinch that is scaling an OBJECT rather than the camera.
const OBJECT_PINCH_GAIN = 1

// A two-finger pinch always twists a little; an object must not spin while
// someone is only trying to scale it. Rotation stays locked until the twist
// passes this much, then follows the fingers.
const TWIST_DEADZONE = (6 * Math.PI) / 180

// ---------------------------------------------------------------------------
// Mirrored from canvasNav.js — its zoom band and its soft visibility clamp.
// Deliberately re-declared rather than exported from there: canvasNav's
// internals stay internal (the desktop file is not edited for a phone's sake).
// If these change there, change them here. Same values, same behavior:
// the artboard may roam or fill the view but can never leave the screen.
// ---------------------------------------------------------------------------
const ZOOM_MIN = 0.1
const ZOOM_MAX = 8
const KEEP_VISIBLE = 96

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Shortest signed angle between two headings — a twist through ±π must not
// read as a full turn the other way.
function angleDelta(to, from) {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

// The default routing test: BOTH fingers on one object hands the gesture to
// that object; anything else is the camera. `canvas.skipTargetFind` is honored
// first — while a brush is active Fabric itself targets nothing, so two fingers
// there are always the camera, which is what a painter expects.
function defaultObjectGesture(canvas, a, b) {
  if (canvas.skipTargetFind) return null
  const objects = canvas.getObjects()
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (!obj.visible || !obj.evented || !obj.selectable) continue
    if (obj.containsPoint(a) && obj.containsPoint(b)) return obj
  }
  return null
}

export function attachCanvasNavTouch(canvas, nav, opts = {}) {
  const el = canvas.upperCanvasEl
  if (!el) return { dispose: () => {} }

  // One camera, one driver. canvasNav's keyboard/wheel gestures have no place
  // on a phone and would fight this one for the viewport.
  nav?.setEnabled?.(false)

  const resolveObject =
    opts.objectGesture === false
      ? () => null
      : typeof opts.objectGesture === 'function'
        ? opts.objectGesture
        : defaultObjectGesture

  let gesture = null // { ids, mode, obj, lastMid, lastDist, lastAngle, twist, twisting }
  let saved = null // canvas props snapshot while armed
  let disarmTimer = 0

  // --- coordinates -----------------------------------------------------------
  // Buffer (viewport) pixels from a Touch, then scene units. The pasteboard
  // buffer is 1:1 with its CSS box, but the ratio is read live so a stretched
  // buffer would still map correctly.
  function viewportPoint(touch, rect) {
    const sx = rect.width ? canvas.getWidth() / rect.width : 1
    const sy = rect.height ? canvas.getHeight() / rect.height : 1
    return { x: (touch.clientX - rect.left) * sx, y: (touch.clientY - rect.top) * sy }
  }
  function toScene(vp) {
    const t = canvas.viewportTransform
    return new Point((vp.x - t[4]) / t[0], (vp.y - t[5]) / t[3])
  }

  // --- the arm ---------------------------------------------------------------
  function arm() {
    if (saved) return
    saved = { selection: canvas.selection, skipTargetFind: canvas.skipTargetFind }
    canvas.__navPanArmed = true // the shared stand-down flag (canvasNav.isPanning)
    canvas.selection = false
    canvas.skipTargetFind = true
    // No cursor changes here, unlike canvasNav: a finger has no cursor, and the
    // brush circle is positioned by the brush's own pointer listeners.
  }
  function disarm() {
    if (!saved) return
    canvas.__navPanArmed = false
    canvas.selection = saved.selection
    canvas.skipTargetFind = saved.skipTargetFind
    saved = null
    canvas.requestRenderAll()
  }

  // Fabric may already be dragging or scaling an object with finger one. Let go
  // of it where it stands — never revert, never finalize twice: the object keeps
  // whatever the drag gave it, and the gesture takes over from there.
  function releaseFabricTransform() {
    const t = canvas._currentTransform
    if (!t) return
    t.target?.setCoords()
    canvas._currentTransform = null
  }

  // Drop any brush stroke still under finger one. Every stroke engine publishes
  // its canceller on the canvas (brushCore) — the same explicit canvas-level
  // convention as __navPanArmed — so this works for the standing mask brush and
  // for a card's own session alike, with no card branch anywhere.
  function cancelLiveStrokes() {
    const cancels = canvas.__brushCancels
    if (!cancels) return
    for (const cancel of [...cancels]) cancel()
  }

  // --- the camera ------------------------------------------------------------
  // The soft clamp, same shape and same constant as canvasNav's: at least
  // KEEP_VISIBLE screen-pixels of the artboard stay on each axis, so a pinch or
  // a pan can never push the page out of sight.
  function clampPan() {
    const vpt = canvas.viewportTransform.slice()
    const zoom = canvas.getZoom()
    const bw = canvas.getWidth()
    const bh = canvas.getHeight()
    const spanX = ARTBOARD_WIDTH * zoom
    const spanY = ARTBOARD_HEIGHT * zoom
    vpt[4] = Math.min(bw - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - spanX, vpt[4]))
    vpt[5] = Math.min(bh - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - spanY, vpt[5]))
    canvas.setViewportTransform(vpt)
  }

  function moveCamera(mid, dist) {
    const factor = Math.pow(dist / gesture.lastDist, PINCH_GAIN)
    const zoom = clamp(canvas.getZoom() * factor, ZOOM_MIN, ZOOM_MAX)
    // zoomToPoint keeps the given VIEWPORT point fixed while it rescales
    // (canvasNav's note, verified against Fabric 6.9.1) — so the pinch grows
    // the picture out of the point between the fingers.
    canvas.zoomToPoint(new Point(mid.x, mid.y), zoom)
    const vpt = canvas.viewportTransform.slice()
    vpt[4] += mid.x - gesture.lastMid.x
    vpt[5] += mid.y - gesture.lastMid.y
    canvas.setViewportTransform(vpt)
    clampPan()
  }

  // --- the object ------------------------------------------------------------
  // The whole gesture as one incremental similarity transform about the pinch
  // midpoint: the object scales, twists and travels with the fingers, so the
  // pixels under each thumb stay under it.
  function moveObject(mid, dist, angle) {
    const obj = gesture.obj
    const factor = Math.pow(dist / gesture.lastDist, OBJECT_PINCH_GAIN)
    let turn = angleDelta(angle, gesture.lastAngle)
    if (!gesture.twisting) {
      gesture.twist += turn
      if (Math.abs(gesture.twist) < TWIST_DEADZONE) turn = 0
      else gesture.twisting = true
    }

    const pivot = toScene(gesture.lastMid)
    const next = toScene(mid)
    const center = obj.getCenterPoint()
    // p' = m' + R(dθ)·k·(p − m)
    const dx = (center.x - pivot.x) * factor
    const dy = (center.y - pivot.y) * factor
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)

    obj.set({
      scaleX: obj.scaleX * factor,
      scaleY: obj.scaleY * factor,
      angle: obj.angle + (turn * 180) / Math.PI
    })
    obj.setPositionByOrigin(
      new Point(next.x + dx * cos - dy * sin, next.y + dx * sin + dy * cos),
      'center',
      'center'
    )
    obj.setCoords()
    canvas.requestRenderAll()
  }

  // --- the gesture -----------------------------------------------------------
  const inCanvas = (target) => target === el || (target && el.contains?.(target))

  function metrics(a, b) {
    return {
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x)
    }
  }

  function onTouchStart(e) {
    if (!inCanvas(e.target)) return
    if (e.touches.length < 2 || gesture) return
    clearTimeout(disarmTimer)

    const rect = el.getBoundingClientRect()
    const [t0, t1] = [e.touches[0], e.touches[1]]
    const v0 = viewportPoint(t0, rect)
    const v1 = viewportPoint(t1, rect)

    // Route BEFORE arming: arming suspends target-finding, which is exactly
    // what the routing test reads.
    const obj = resolveObject(canvas, toScene(v0), toScene(v1))

    releaseFabricTransform()
    cancelLiveStrokes()
    arm()

    const m = metrics(v0, v1)
    gesture = {
      ids: [t0.identifier, t1.identifier],
      mode: obj ? 'object' : 'camera',
      obj,
      lastMid: m.mid,
      lastDist: m.dist,
      lastAngle: m.angle,
      twist: 0,
      twisting: false
    }
    if (obj) canvas.setActiveObject(obj)
  }

  function find(touches, id) {
    for (const touch of touches) if (touch.identifier === id) return touch
    return null
  }

  function onTouchMove(e) {
    if (!gesture) return
    const a = find(e.touches, gesture.ids[0])
    const b = find(e.touches, gesture.ids[1])
    if (!a || !b) return
    e.preventDefault() // belt-and-braces with touch-action: none on the wrap

    const rect = el.getBoundingClientRect()
    const m = metrics(viewportPoint(a, rect), viewportPoint(b, rect))
    if (gesture.mode === 'object') moveObject(m.mid, m.dist, m.angle)
    else moveCamera(m.mid, m.dist)
    gesture.lastMid = m.mid
    gesture.lastDist = m.dist
    gesture.lastAngle = m.angle
  }

  function onTouchEnd(e) {
    // The pinch dies when either finger leaves; the ARM lives until the surface
    // is clear, so the finger left behind can't start a stroke or grab a handle.
    // Hence two separate guards: the gesture may already be gone while the arm
    // (and the touchend that clears it) is still to come.
    if (gesture && (!find(e.touches, gesture.ids[0]) || !find(e.touches, gesture.ids[1]))) gesture = null
    if (!saved || e.touches.length > 0) return
    // Disarm on the next task, never in this handler: Fabric's own touchend
    // runs after ours (we are the capture listener) and must see the canvas
    // still inert, or the release re-targets whatever is under the finger.
    clearTimeout(disarmTimer)
    disarmTimer = setTimeout(disarm, 0)
  }

  // Capture phase on the window — see the header: this is the arming moment,
  // and it has to beat Fabric's listener on the upper canvas. Non-passive
  // because the move handler preventDefaults.
  const capture = { capture: true, passive: false }
  window.addEventListener('touchstart', onTouchStart, capture)
  window.addEventListener('touchmove', onTouchMove, capture)
  window.addEventListener('touchend', onTouchEnd, capture)
  window.addEventListener('touchcancel', onTouchEnd, capture)

  return {
    dispose: () => {
      window.removeEventListener('touchstart', onTouchStart, capture)
      window.removeEventListener('touchmove', onTouchMove, capture)
      window.removeEventListener('touchend', onTouchEnd, capture)
      window.removeEventListener('touchcancel', onTouchEnd, capture)
      clearTimeout(disarmTimer)
      gesture = null
      disarm()
    }
  }
}
