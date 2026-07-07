import { useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'
import CanvasStage from '../editor/CanvasStage.jsx'
import { createMaster, showMaster, bake } from '../editor/masterRaster.js'
import '../editor/editor.css'
import './foundry.css'

// Foundry canvas geometry (card_maker.md §2): the working canvas IS the
// deliverable's size — 745×1040, the exact face Card.jsx renders — with a
// master at the same 3× scale Deck uses.
export const FACE_WIDTH = 745
export const FACE_HEIGHT = 1040
export const FACE_MASTER_WIDTH = FACE_WIDTH * 3 // 2235
export const FACE_MASTER_HEIGHT = FACE_HEIGHT * 3 // 3120

// Phase-0 proving shell (card_maker.md §6, Phase 0). Throwaway by design:
// mounts the card-format canvas + master, arms a scribble brush, and Ends
// through the universal bake — proving the shared raster machinery at the
// new dimensions before any real Foundry machinery exists. FoundryEditor +
// foundryDeck.js replace this shell in Phase 1.
export default function FoundryApp() {
  const stageRef = useRef(null)
  const masterRef = useRef(null)
  const [bakes, setBakes] = useState(0)

  useEffect(() => {
    const canvas = stageRef.current?.getCanvas()
    if (!canvas) return
    masterRef.current = createMaster(FACE_MASTER_WIDTH, FACE_MASTER_HEIGHT)
    showMaster(canvas, masterRef.current)
    // Fabric 6 no longer auto-creates the brush; instantiate it explicitly.
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
    canvas.freeDrawingBrush.width = 6
    canvas.freeDrawingBrush.color = '#1a1a1a'
    canvas.isDrawingMode = true
  }, [])

  function handleEnd() {
    const canvas = stageRef.current?.getCanvas()
    if (!canvas) return
    masterRef.current = bake(canvas)
    canvas.isDrawingMode = true
    setBakes((n) => n + 1)
  }

  return (
    <div className="foundry-shell">
      <header className="foundry-header">
        <h1>Foundry</h1>
        <span className="foundry-note">
          phase-0 proving shell · 745×1040 · master 2235×3120 ·
          scribble, then End{bakes > 0 ? ` · ${bakes} committed` : ''}
        </span>
        <button className="foundry-end" onClick={handleEnd}>End</button>
      </header>
      <main className="foundry-stage">
        <CanvasStage ref={stageRef} width={FACE_WIDTH} height={FACE_HEIGHT} />
      </main>
    </div>
  )
}
