// Delay — the held ending (v4 notes §5.9). Committing this round grants a
// standing right: the FIRST Coda dealt afterward waits for a choice —
// accept the ending, or set it aside once (an honest random reinsert; the
// redeal is blind and the Coda can come straight back). Accepting while
// the right is still held is the strongest ending: the piece was signed,
// not stopped.
//
// The card itself is the lightest in the deck: it never touches the canvas
// (skipBake) and asks nothing at deal time — the decision it buys happens
// later, at the Coda. The right shows as a small face-up card at the deal
// panel until spent (deck.js `delayHeld`; the choice beat is the
// CODA_CHOICE phase).

export function DelayTools({ ready }) {
  return (
    <span className="hint">
      {ready
        ? 'From this round on, the first Coda can be set aside — once. The right waits at the deal panel. End the round.'
        : 'Setting up…'}
    </span>
  )
}
