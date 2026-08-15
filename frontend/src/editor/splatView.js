// The splat viewport — a gaussian-splat scene mounted in a DOM box, orbitable,
// and renderable to an offscreen canvas at any resolution.
//
// Shared infrastructure, not card-private: anything that wants to re-photograph
// the composition from a 3D camera builds on this. It wraps `three` +
// `@mkkellogg/gaussian-splats-3d` and hides the two things that library makes
// awkward — reading pixels back at a size other than the on-screen one, and
// tearing the whole apparatus down (workers, GL context) on a restart.
//
// The caller owns the container's size. The on-screen box IS the commit frame:
// keep it at the artboard's 4:5 and what you see is what renderAt() gives you.

import * as THREE from 'three'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

// SHARP emits in the OpenCV convention: x right, y DOWN, z forward, the camera
// at the origin and the scene sitting out in front of it. So a camera at the
// origin with up (0,-1,0) looking at (0,0,2) is the original photograph's own
// viewpoint — which is where the card opens and where "reset view" returns.
const CAMERA_UP = [0, -1, 0]
const CAMERA_POSITION = [0, 0, 0]
const CAMERA_LOOK_AT = [0, 0, 2]

/**
 * Mount a splat scene from a .ply blob into `container`.
 *
 * Returns the handle, or null if `isCancelled()` went true during the load —
 * the house idiom for an async begin that got restarted out from under it.
 * Everything is torn down on that path; the caller does nothing.
 */
export async function createSplatView(container, plyBlob, { isCancelled = () => false } = {}) {
  // The library's own renderer is built without `alpha`, which makes the
  // drawing buffer opaque black — fatal for us, since the whole point of the
  // commit render is that the splat's voids come out transparent and the
  // pre-card snapshot shows through the tears. So we build the renderer and
  // hand it in. preserveDrawingBuffer is the belt-and-braces for readback:
  // without it a canvas is only legible in the same task as its render, and
  // v1 already shipped one blank-PNG export bug on that rule.
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    precision: 'highp',
    preserveDrawingBuffer: true
  })
  const liveRatio = window.devicePixelRatio || 1
  renderer.setPixelRatio(liveRatio)
  renderer.setClearColor(0x000000, 0)
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  const url = URL.createObjectURL(plyBlob)
  let urlLive = true
  const revoke = () => {
    if (urlLive) {
      urlLive = false
      URL.revokeObjectURL(url)
    }
  }

  const viewer = new GaussianSplats3D.Viewer({
    renderer,
    rootElement: container,
    cameraUp: CAMERA_UP,
    initialCameraPosition: CAMERA_POSITION,
    initialCameraLookAt: CAMERA_LOOK_AT,
    sphericalHarmonicsDegree: 2,
    sharedMemoryForWorkers: false, // no COOP/COEP headers in dev or in Electron
    // The library's default reveal fades the scene in from the centre outwards
    // over the first seconds. A commit fired during that animation captures a
    // half-revealed frame — and it is an animation nobody asked for. Instant.
    sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant
  })

  let disposed = false

  // Supplying our own renderer also opts us out of the library's ResizeObserver.
  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return
    renderer.setSize(container.clientWidth, container.clientHeight)
    viewer.forceRenderNextFrame()
  })
  resizeObserver.observe(container)

  async function dispose() {
    if (disposed) return
    disposed = true
    resizeObserver.disconnect()
    // Viewer.dispose aborts any in-flight download, waits for the sort worker
    // to settle, then terminates it. It touches renderer.domElement on the way
    // out (event handlers), so the GL teardown has to come after it.
    try {
      await viewer.dispose()
    } catch {
      // a dispose mid-load rejects the load promise; nothing to salvage
    }
    renderer.domElement.remove()
    renderer.dispose()
    renderer.forceContextLoss() // browsers cap live contexts; don't wait for GC
    revoke()
  }

  try {
    // A blob URL carries no extension, so the format has to be declared.
    await viewer.addSplatScene(url, {
      showLoadingUI: false,
      format: GaussianSplats3D.SceneFormat.Ply
    })
  } catch (err) {
    await dispose()
    if (isCancelled()) return null
    throw err
  }
  revoke() // the library holds the parsed buffer now

  if (isCancelled()) {
    await dispose()
    return null
  }

  viewer.start()

  // Every screen-space quantity in the library scales linearly by the pixel
  // ratio — the drawing buffer, the splat shader's viewport uniform, its focal
  // lengths. So an offscreen render at N× the on-screen box is exactly a pixel
  // ratio of N, and nothing else has to move: no reflow, no camera change, no
  // aspect change. The one catch is that the ratio lives in three places.
  function setPixelRatio(ratio) {
    viewer.devicePixelRatio = ratio
    if (viewer.splatMesh) viewer.splatMesh.devicePixelRatio = ratio
    renderer.setPixelRatio(ratio) // three re-sizes the buffer, keeps the CSS size
    viewer.updateSplatMesh() // pushes viewport + focal uniforms
  }

  // The largest ratio at or below `wanted` that this GL implementation will
  // actually draw into. Halving rather than trimming keeps the framing exact;
  // the readback stretches whatever we got onto the requested canvas, so a
  // capped device degrades to a soft render, never a wrong or failed one.
  function fittingRatio(wanted, cssWidth, cssHeight) {
    const gl = renderer.getContext()
    const maxDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS)
    const cap = Math.min(maxDims[0], maxDims[1], gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
    let ratio = wanted
    while (ratio > 1 && (cssWidth * ratio > cap || cssHeight * ratio > cap)) ratio /= 2
    return ratio
  }

  // Wait for the sort worker to hand back and apply an order. `sortPromise` is
  // null when nothing is in flight, and `await null` is a no-op, so this reads
  // as "settle if there is anything to settle".
  const settleSort = () => Promise.resolve(viewer.sortPromise)

  // Get every splat that the current camera can see sorted, for real.
  //
  // The live loop deliberately sorts in fractions — it queues a few partial
  // sorts per camera move and only reaches the full set if the camera holds
  // still. It also culls to the frustum it last sorted for. Both are right in
  // motion and wrong for a commit: render straight after a camera jump and you
  // get holes where the previous frustum had nothing. So: drain the queue by
  // forcing repeatedly until a pass covers the whole visible set.
  //
  // `runSplatSort` assigns `sortPromise` inside a `.then`, not synchronously —
  // its own promise has to be awaited first or we settle on the previous sort.
  async function sortFully() {
    await settleSort() // a sort already in flight would swallow the force
    for (let pass = 0; pass < 8; pass++) {
      await viewer.runSplatSort(true, true)
      await settleSort()
      if (viewer.splatSortCount >= viewer.splatRenderCount) return
    }
  }

  return {
    /** The live THREE camera. Read it; move it through the controls, not here. */
    getCamera: () => viewer.camera,

    /** Back to the original photograph's viewpoint. */
    resetCamera() {
      if (disposed) return
      // The orbit a drag started keeps decaying inside the controls for a
      // while after the mouse is up (damping). Those held deltas outrank
      // anything written into the camera — set the position without clearing
      // them and the next update() drags most of the reset back out, so the
      // view only creeps home a twentieth at a time. Drop them first.
      viewer.controls.clearDampedRotation?.()
      viewer.controls.clearDampedPan?.()
      viewer.camera.position.set(...CAMERA_POSITION)
      viewer.camera.up.set(...CAMERA_UP)
      viewer.controls.target.set(...CAMERA_LOOK_AT)
      viewer.controls.update()
      viewer.forceRenderNextFrame()
    },

    /**
     * One frame from the current camera at `width`×`height` physical pixels,
     * transparent where the splat has no coverage. Returns a 2d canvas.
     */
    async renderAt(width, height) {
      if (disposed) throw new Error('splat view is disposed')

      // The ratio below is target ÷ on-screen, so a collapsed container would
      // ask for an infinite one. Nothing sensible to render from anyway.
      if (!container.clientWidth || !container.clientHeight) {
        throw new Error('splat view container has no size')
      }

      // Stop the live loop first so it can't start a sort behind our back.
      viewer.stop()
      try {
        await sortFully()
        if (disposed) throw new Error('splat view is disposed')

        const ratio = fittingRatio(height / container.clientHeight, container.clientWidth, container.clientHeight)
        setPixelRatio(ratio)
        viewer.render()

        const out = document.createElement('canvas')
        out.width = width
        out.height = height
        out.getContext('2d').drawImage(renderer.domElement, 0, 0, width, height)
        return out
      } finally {
        if (!disposed) {
          setPixelRatio(liveRatio)
          viewer.start()
        }
      }
    },

    /** Safe at any point, including part-way through the load. Idempotent. */
    dispose
  }
}
