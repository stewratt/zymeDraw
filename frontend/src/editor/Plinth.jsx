// The plinth (v4, notes §11.2): once the Coda lands, the canvas area gives
// way to a small three.js room where the finished piece floats as a shallow
// panel — grab to orbit, scroll to zoom in on the detail, right-drag to pan.
// Purely cosmetic: it reads the final master as a texture and touches
// nothing else; the Fabric canvas stays mounted underneath.
//
// Editor imports this via React.lazy — three.js is by far the heaviest
// frontend dependency, and this way it only downloads once a piece is
// actually finished, never during a working session.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Panel proportions in scene units: the canvas's 4:5, with the depth a
// stretcher-bar sliver — enough to read as an object, not a slab.
const PANEL_W = 4
const PANEL_H = 5
const PANEL_D = 0.14

export default function Plinth({ master }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !master) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)

    // Everything is unlit: the artwork face shows exactly as exported (no
    // lighting tint), and the edges hold a constant grey — the UI's --fill,
    // the primary-button colour — from every angle. No lights in the scene.
    const texture = new THREE.CanvasTexture(master)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const edge = new THREE.MeshBasicMaterial({ color: 0x333333 })
    const front = new THREE.MeshBasicMaterial({ map: texture })
    // BoxGeometry material order: +x, -x, +y, -y, +z (front), -z (back).
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(PANEL_W, PANEL_H, PANEL_D),
      [edge, edge, edge, edge, front, edge]
    )
    scene.add(panel)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 1
    controls.maxDistance = 30

    function resize() {
      const { clientWidth: w, clientHeight: h } = mount
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()

    // Start the camera where the panel fits with some air, whichever axis
    // is tighter. Initial position only — resizes never yank the view back.
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    camera.position.set(
      0,
      0,
      1.2 * Math.max(PANEL_H / 2 / half, PANEL_W / 2 / (half * camera.aspect))
    )

    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    renderer.setAnimationLoop(() => {
      controls.update() // damping needs per-frame updates
      renderer.render(scene, camera)
    })

    return () => {
      observer.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      panel.geometry.dispose()
      texture.dispose()
      edge.dispose()
      front.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [master])

  return <div className="plinth" ref={mountRef} />
}
