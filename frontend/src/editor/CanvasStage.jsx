import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as fabric from 'fabric'

// Deck's fixed 8x10 portrait at the default working resolution. CSS controls
// how big it appears on screen; the internal pixel buffer stays 800x1000 so
// Fabric operations and (eventually) the high-resolution export math both
// behave predictably. Foundry passes its own card-format dimensions
// (745×1040) as props; without props nothing changes for Deck.
export const CANVAS_WIDTH = 800
export const CANVAS_HEIGHT = 1000

// Exposes a small imperative handle: `ref.current.getCanvas()` returns the
// Fabric Canvas instance once it's been created. The parent (Editor) needs
// this so card actions can add/remove/manipulate Fabric objects.
const CanvasStage = forwardRef(function CanvasStage(
  { width = CANVAS_WIDTH, height = CANVAS_HEIGHT },
  ref
) {
  const elRef = useRef(null)
  const canvasRef = useRef(null)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current
  }), [])

  useEffect(() => {
    if (!elRef.current) return
    const canvas = new fabric.Canvas(elRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      // Corner handles scale x/y independently (non-uniform) by default.
      // Aspect-ratio lock isn't wanted here; free x/y scaling is the useful one.
      uniformScaling: false,
      // Disable rubber-band group-select. Per-object click/drag still works.
      selection: false
    })
    canvasRef.current = canvas
    return () => {
      canvasRef.current = null
      canvas.dispose()
    }
  }, [width, height])

  return (
    // Inline aspect-ratio overrides editor.css's Deck-shaped 4/5 default so
    // the on-screen box always matches the buffer's proportions.
    <div className="canvas-wrap" style={{ aspectRatio: `${width} / ${height}` }}>
      <canvas ref={elRef} />
    </div>
  )
})

export default CanvasStage
