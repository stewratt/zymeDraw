// The session's sounds. One module so no component owns an <audio> element
// and no file path is written twice.
//
// Each play clones the loaded element rather than replaying the shared one:
// two deals in quick succession overlap instead of the second cutting the
// first off mid-flip. Browsers refuse audio until the page has been clicked;
// every sound here follows a click, so a rejected play() only ever means a
// muted tab — swallow it rather than break the turn.

import cardFlipUrl from '../assets/sounds/cardflip.mp3'

const VOLUME = 0.5

const cardFlip = new Audio(cardFlipUrl)
cardFlip.preload = 'auto'

export function playCardFlip() {
  const shot = cardFlip.cloneNode()
  shot.volume = VOLUME
  shot.play().catch(() => {})
}
