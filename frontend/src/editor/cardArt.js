// Card face art — one image per card design, keyed by card id.
//
// Faces live at frontend/src/assets/cards/<id>.png, 745×1040 (the scale
// Stew's designed deck is drawn at). The glob binds whatever files actually
// exist, so a clone without the art still builds and runs — <Card> falls
// back to its text face wherever getCardArt returns null. Today the files
// are local-only placeholders (the repo's global *.png gitignore keeps them
// out); real art replaces them file-for-file with no code change. When it
// lands, un-ignore it with `!frontend/src/assets/cards/*.png`.

const faces = import.meta.glob('../assets/cards/*.png', {
  eager: true,
  import: 'default'
})

export function getCardArt(id) {
  return faces[`../assets/cards/${id}.png`] ?? null
}
