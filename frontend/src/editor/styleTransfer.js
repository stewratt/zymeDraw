// Style transfer fetch — shared by Transfer and Shattered Transfer.
// Master → working-res PNG → the sidecar's fast-neural-style model →
// styled canvas element. Any failure throws; callers degrade to no
// overlay (the session never blocks on ML, CLAUDE.md §3).
//
// STYLE is the drop-in point once home-trained models join the sidecar's
// STYLES registry (backend/ml/styler.py).

const STYLE = 'rain-princess'
// The model's marks are a fixed size in ITS pixels, so the resolution we
// feed it sets how fine the style reads on the piece: smaller = chunkier.
// 1200 wide → ~2.4 s on CPU and marks that survive the 2× stretch to master.
const INPUT_WIDTH = 1200

export async function fetchStyledCanvas(master) {
  const health = await fetch('/api/ml/health').then((r) => r.json())
  if (!health.ok) throw new Error('sidecar down')

  const input = document.createElement('canvas')
  input.width = INPUT_WIDTH
  input.height = Math.round((INPUT_WIDTH * master.height) / master.width)
  const ictx = input.getContext('2d')
  ictx.imageSmoothingQuality = 'high'
  ictx.drawImage(master, 0, 0, input.width, input.height)

  const blob = await new Promise((resolve) => input.toBlob(resolve, 'image/png'))
  const r = await fetch(`/api/ml/style?style=${STYLE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: blob
  })
  if (!r.ok) throw new Error('style transfer failed')

  const bmp = await createImageBitmap(await r.blob())
  const styled = document.createElement('canvas')
  styled.width = bmp.width
  styled.height = bmp.height
  styled.getContext('2d').drawImage(bmp, 0, 0)
  bmp.close()
  return styled
}
