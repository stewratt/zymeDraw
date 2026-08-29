// Wave 0 throwaway spike (to_do/mobile_plan.md §7) — delete when the wave closes.
//
// Not a card and not brushCore — a stand-in that reproduces the memory shape a
// reveal card imposes (§4.1): while the brush is on, THREE master-sized canvases
// stay alive (scratch, committed, composite) on top of the master itself. Dabs
// are painted at master resolution so the cost is the real one. Off releases
// them, which is the other half of the measurement.

import * as fabric from 'fabric'

const DAB_SPACING = 0.25 // of the radius — dense enough to read as a stroke

function allocate(width, height) {
  const el = document.createElement('canvas')
  el.width = width
  el.height = height
  const ctx = el.getContext('2d')
  if (!ctx) return null
  // Commit the backing store: an allocation the browser quietly refuses looks
  // fine until something draws into it.
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fillRect(0, 0, width, height)
  return el
}

function release(el) {
  if (!el) return
  el.width = 0
  el.height = 0
}

export function createBrush(stage) {
  let layers = null // { scratch, committed, composite }
  let overlay = null // the Fabric object showing the composite
  let stroking = false
  let last = null
  let size = 140 // screen-ish diameter in scene units
  const pointers = new Set()

  function compose() {
    const { composite, committed, scratch } = layers
    const ctx = composite.getContext('2d')
    ctx.clearRect(0, 0, composite.width, composite.height)
    ctx.drawImage(committed, 0, 0)
    ctx.drawImage(scratch, 0, 0)
    overlay.dirty = true
    stage.canvas.requestRenderAll()
  }

  function dab(scenePoint) {
    const s = stage.masterScale
    const x = scenePoint.x * s
    const y = scenePoint.y * s
    const r = (size / 2) * s
    const ctx = layers.scratch.getContext('2d')
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    // Dark ink, because the master starts white — the point is to see the
    // stroke land and feel its latency, not to imitate any card's pigment.
    grad.addColorStop(0, 'rgba(24,24,30,0.35)')
    grad.addColorStop(1, 'rgba(24,24,30,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Interpolate so a fast finger doesn't leave a dotted line.
  function stampTo(point) {
    if (!last) {
      dab(point)
      last = point
      return
    }
    const step = Math.max(2, (size * DAB_SPACING))
    const dx = point.x - last.x
    const dy = point.y - last.y
    const dist = Math.hypot(dx, dy)
    const n = Math.max(1, Math.ceil(dist / step))
    for (let i = 1; i <= n; i += 1) {
      dab({ x: last.x + (dx * i) / n, y: last.y + (dy * i) / n })
    }
    last = point
  }

  const onDown = (opt) => {
    if (!layers || pointers.size > 1) return
    stroking = true
    last = null
    stampTo(stage.canvas.getScenePoint(opt.e))
    compose()
  }
  const onMove = (opt) => {
    if (!stroking) return
    // A second finger is the camera, never a stroke — drop what's in progress
    // rather than smearing across a pinch (the Wave 3 grammar, in miniature).
    if (pointers.size > 1) {
      stroking = false
      layers.scratch.getContext('2d').clearRect(0, 0, layers.scratch.width, layers.scratch.height)
      compose()
      return
    }
    stampTo(stage.canvas.getScenePoint(opt.e))
    compose()
  }
  const onUp = () => {
    if (!stroking || !layers) return
    stroking = false
    last = null
    // Settle the stroke into the committed layer, as a real brush session does.
    layers.committed.getContext('2d').drawImage(layers.scratch, 0, 0)
    layers.scratch.getContext('2d').clearRect(0, 0, layers.scratch.width, layers.scratch.height)
    compose()
  }

  const trackDown = (e) => pointers.add(e.pointerId)
  const trackUp = (e) => pointers.delete(e.pointerId)

  // Returns a plain string for the report: how many of the three landed.
  function on() {
    if (layers) return 'already on'
    const master = stage.getMaster()
    const w = master.width
    const h = master.height
    const scratch = allocate(w, h)
    const committed = allocate(w, h)
    const composite = allocate(w, h)
    const got = [scratch, committed, composite].filter(Boolean).length
    if (got < 3) {
      release(scratch)
      release(committed)
      release(composite)
      return `FAILED — only ${got} of 3 master-sized layers allocated`
    }
    layers = { scratch, committed, composite }
    overlay = new fabric.FabricImage(composite, {
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX: 1 / stage.masterScale,
      scaleY: 1 / stage.masterScale,
      selectable: false,
      evented: false,
      objectCaching: false
    })
    stage.canvas.add(overlay)
    stage.canvas.skipTargetFind = true
    stage.canvas.on('mouse:down', onDown)
    stage.canvas.on('mouse:move', onMove)
    stage.canvas.on('mouse:up', onUp)
    const el = stage.canvas.upperCanvasEl
    el.addEventListener('pointerdown', trackDown)
    el.addEventListener('pointerup', trackUp)
    el.addEventListener('pointercancel', trackUp)
    const mb = (w * h * 4) / (1024 * 1024)
    return `3 master-sized layers held (${w}×${h}, ~${mb.toFixed(1)} MB each, ~${(mb * 3).toFixed(1)} MB total)`
  }

  function off() {
    if (!layers) return 'already off'
    stage.canvas.off('mouse:down', onDown)
    stage.canvas.off('mouse:move', onMove)
    stage.canvas.off('mouse:up', onUp)
    const el = stage.canvas.upperCanvasEl
    el.removeEventListener('pointerdown', trackDown)
    el.removeEventListener('pointerup', trackUp)
    el.removeEventListener('pointercancel', trackUp)
    pointers.clear()
    stage.canvas.skipTargetFind = false
    if (overlay) stage.canvas.remove(overlay)
    release(layers.scratch)
    release(layers.committed)
    release(layers.composite)
    layers = null
    overlay = null
    stroking = false
    stage.canvas.requestRenderAll()
    return 'released'
  }

  // The bake sweeps every object off the canvas, the overlay included, and the
  // brushwork is now in the master. Rebuild empty layers so brushing continues.
  function afterBake() {
    if (!layers) return null
    off()
    return on()
  }

  return {
    on,
    off,
    afterBake,
    isOn: () => !!layers,
    setSize: (n) => {
      size = n
    }
  }
}
