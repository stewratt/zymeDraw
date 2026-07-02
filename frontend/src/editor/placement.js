// Placement sessions — loads chosen images onto the working canvas as
// free-transform objects (move / scale / rotate). Shared by the opening
// placement and the stash return.
//
// Images keep their native-resolution source: Fabric renders from the
// original pixels, so the 3× bake samples full detail regardless of how
// small an image appears on the working canvas.

import * as fabric from 'fabric'

export async function placeImages(canvas, filenames, isCancelled = () => false) {
  const W = canvas.getWidth()
  const H = canvas.getHeight()

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
