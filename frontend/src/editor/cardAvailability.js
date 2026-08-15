// Machine capability, per card. Almost every card runs anywhere; a few need
// something the sidecar only has if the machine opted into it (today just
// Splatt's depth model, an extra install — see backend/ml/requirements-splat.txt).
// The repo is cloned on three machines, so a deck built on one can be carried
// to another that can't run it; this module is the one place that knows which
// cards can be, and how to ask.
//
// Deliberately NOT in deck.js: the reducer is pure and never learns about the
// machine it happens to be running on (the same reason the deck editor's cap
// and floor live outside it).

import { MOD_CARDS } from './deck.js'

// The whole concept: card id → the /health flag that has to be true, plus the
// endpoint that warms the model up. A card that needs nothing isn't listed.
export const CARD_REQUIREMENTS = {
  splatt: { flag: 'splatAvailable', warm: '/api/ml/splat/warm' }
}

// The gated cards a deck spec would actually deal (null spec = the house deck).
export function gatedCardsIn(spec) {
  return (spec ?? MOD_CARDS)
    .filter((c) => c.copies > 0 && c.id in CARD_REQUIREMENTS)
    .map((c) => c.id)
}

// Ask the sidecar once. Per card: true = it can run this here, false = it
// answered and said no, null = no answer at all (sidecar down or still
// starting). Callers decide what to do with "no answer" — the deck editor
// treats it as a no (it can only offer what it can confirm), session start
// does not (a card whose service is merely down degrades on its own).
export async function fetchCardAvailability() {
  let health = null
  try {
    // Timed out rather than awaited forever: session start waits on this, and
    // a hung sidecar must never hold the door shut.
    const res = await fetch('/api/ml/health', { signal: AbortSignal.timeout(2000) })
    if (res.ok) health = await res.json()
  } catch {
    // No sidecar, no answer.
  }
  const availability = {}
  for (const [id, { flag }] of Object.entries(CARD_REQUIREMENTS)) {
    availability[id] = health?.ok ? !!health[flag] : null
  }
  return availability
}

// Fire-and-forget: the model is minutes of load on a cold machine, so the
// session pokes it awake the moment it starts rather than at the deal. Nothing
// waits on this and nothing reports its failure — the card handles a cold or
// absent model by itself.
export function prewarmCards(spec) {
  for (const id of gatedCardsIn(spec)) {
    const { warm } = CARD_REQUIREMENTS[id]
    if (warm) fetch(warm, { method: 'POST' }).catch(() => {})
  }
}
