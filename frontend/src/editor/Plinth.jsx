// The plinth (v4, notes §11.2): once the Coda lands, the canvas area gives
// way to a small three.js room where the finished piece floats as a shallow
// panel — grab to orbit, scroll to zoom in on the detail, right-drag to pan.
// Purely cosmetic: it reads the final master as a texture and touches
// nothing else; the Fabric canvas stays mounted underneath.
//
// The states (v4 notes §9): C cycles the panel's face through the session's
// committed states in order, then back to the finished piece. View only —
// nothing here exports or re-enters a state; the piece is the piece.
//
// Editor imports this via React.lazy — three.js is by far the heaviest
// frontend dependency, and this way it only downloads once a piece is
// actually finished, never during a working session.

import { useEffect, useRef, useState } from 'react'
import { UI, fmt } from '../copy/uiText.js'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Panel proportions in scene units: the canvas's 4:5, with the depth a
// stretcher-bar sliver — enough to read as an object, not a slab.
const PANEL_W = 4
const PANEL_H = 5
const PANEL_D = 0.14

export default function Plinth({ master, states = [] }) {
  const mountRef = useRef(null)

  // Which face is showing: null = the finished piece (the master, lossless);
  // otherwise an index into states. The last cached state IS the finished
  // piece (the capture happens at the final bake), so the cycle only visits
  // the earlier ones before returning to the master.
  const [view, setView] = useState(null)
  const viewRef = useRef(null)
  const sceneRef = useRef(null) // { front, masterTexture, renderer }
  const texCache = useRef(new Map()) // state index → THREE.Texture

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

    sceneRef.current = { front, masterTexture: texture, renderer }

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
      texCache.current.forEach((t) => t.dispose())
      texCache.current.clear()
      sceneRef.current = null
      edge.dispose()
      front.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [master])

  // C leafs through: piece → state 1 → state 2 → … → piece. With one state
  // or none there is nothing earlier to see, so the key does nothing.
  useEffect(() => {
    const pastCount = states.length - 1
    const onKeyDown = (e) => {
      if (e.key !== 'c' && e.key !== 'C') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (pastCount < 1) return
      setView((v) => (v === null ? 0 : v + 1 >= pastCount ? null : v + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [states])

  // Swap the panel's face to match the view. State textures are decoded
  // lazily from their JPEG data URLs and cached; a load that lands after
  // the view has already moved on is kept but not shown.
  useEffect(() => {
    viewRef.current = view
    const s = sceneRef.current
    if (!s) return
    const show = (tex) => {
      s.front.map = tex
      s.front.needsUpdate = true
    }
    if (view === null) {
      show(s.masterTexture)
      return
    }
    const cached = texCache.current.get(view)
    if (cached) {
      show(cached)
      return
    }
    new THREE.TextureLoader().load(states[view].url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = s.renderer.capabilities.getMaxAnisotropy()
      texCache.current.set(view, tex)
      if (viewRef.current === view) show(tex)
    })
  }, [view, states])

  return (
    <div className="plinth" ref={mountRef}>
      {states.length > 1 && (
        <div className="plinth-caption">
          {view === null
            ? UI.plinth.leafHint
            : fmt(UI.plinth.stateCaption, { n: view + 1, total: states.length, label: states[view].label })}
        </div>
      )}
    </div>
  )
}
