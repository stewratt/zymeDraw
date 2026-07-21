// Placement sessions — loads chosen images onto the working canvas as
// free-transform objects (move / scale / rotate). Shared by the opening
// placement and the stash return.
//
// Images keep their native-resolution source: Fabric renders from the
// original pixels, so the 3× bake samples full detail regardless of how
// small an image appears on the working canvas.

import * as fabric from 'fabric'
import { ARTBOARD_WIDTH, ARTBOARD_HEIGHT } from './CanvasStage.jsx'

export async function placeImages(canvas, filenames, isCancelled = () => false) {
  // Fit/center against the ARTBOARD, not the buffer: in pasteboard `fill` mode
  // the buffer is the whole workspace, so getWidth()/getHeight() would drop the
  // image into the void instead of onto the paper (scene 0..800 × 0..1000).
  const W = ARTBOARD_WIDTH
  const H = ARTBOARD_HEIGHT

  const imgs = await Promise.all(
    filenames.map((f) => fabric.FabricImage.fromURL(`/api/images/${encodeURIComponent(f)}`))
  )
  if (isCancelled()) return []

  imgs.forEach((img, i) => {
    // Fit within ~65% of the canvas, keep aspect; cascade the stack
    // diagonally from center so every image stays grabbable.
    const scale = Math.min((W * 0.65) / img.width, (H * 0.65) / img.height)
    const offset = (i - (imgs.length - 1) / 2) * 36
    img.set({
      originX: 'center',
      originY: 'center',
      left: W / 2 + offset,
      top: H / 2 + offset,
      scaleX: scale,
      scaleY: scale
    })
    canvas.add(img)
  })
  canvas.requestRenderAll()
  return imgs
}

// A small preview (data URL) of a placed image's source pixels, for the
// placement layers panel. Drawn from the image's own element at a fitted
// size, so it reads like a Photoshop layer thumbnail.
export function layerThumbUrl(img, box = 44) {
  const src = img.getElement()
  const sw = src.width || src.naturalWidth || 1
  const sh = src.height || src.naturalHeight || 1
  const scale = Math.min(box / sw, box / sh)
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  el.getContext('2d').drawImage(src, 0, 0, w, h)
  return el.toDataURL('image/png')
}
