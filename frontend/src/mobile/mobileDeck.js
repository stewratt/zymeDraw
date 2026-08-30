// The pocket deck — Wave 4's card set (to_do/mobile_plan.md §1.1–1.2, §7).
//
// A deck SPEC, nothing more: [{ id, copies }] is the whole vocabulary the
// reducer takes (deck.js resolveSpec re-derives labels and families itself),
// so this file can never fork the rulebook. The house deck, TUNING, the death
// shuffle and the stash's return all stay exactly as deck.js runs them.
//
// PROVISIONAL, pending Stew's §8 Q3 call (which kept cards, how many copies,
// and whether the bus wants a shorter arc than 4+2). Until that conversation
// this is deliberately NOT a new opinion: it is the DESKTOP house deck
// (deck.js MOD_CARDS) restricted to the cards the phone keeps — same copies,
// same ratios, same 19 cards. Nothing was actually lost in the restriction,
// because every cut or deferred card (Deeper, Splatt, Transfer, Lift, Etch,
// Rack) already sits at 0 copies on the desktop too.
//
// The 0-copy lines are kept and not deleted, for the same reason deck.js keeps
// them: they are the pool, and they say out loud that the card is BUILT and
// playable — one number away from being dealt. Cards the pocket version does
// not carry at all (etch, lift, deeper, splatt, transfer, shatteredTransfer,
// rack) are simply absent.

export const MOBILE_DECK_SPEC = [
  // ---- Graft ----
  { id: 'ghost', copies: 1 },
  { id: 'stain', copies: 1 },
  { id: 'stamp', copies: 2 }, // always its degraded mode here — no sidecar on a phone
  { id: 'reverberate', copies: 0 }, // pool-only on the desktop too
  // ---- Stencil ----
  { id: 'rails', copies: 1 },
  { id: 'char', copies: 1 },
  // ---- Re-frame ----
  { id: 'closer', copies: 1 },
  // ---- Fracture family (pool-only, as on the desktop) ----
  { id: 'fracture', copies: 0 },
  { id: 'gwarp', copies: 0 },
  // ---- Reveal brushes ----
  { id: 'dust', copies: 2 },
  { id: 'bruise', copies: 1 },
  { id: 'blur', copies: 2 },
  // ---- Smieer (pool-only, as on the desktop) ----
  { id: 'smieer', copies: 0 },
  // ---- Washes ----
  { id: 'steep', copies: 1 },
  { id: 'hue', copies: 1 },
  { id: 'cure', copies: 1 },
  // ---- The deck itself ----
  { id: 'searcher', copies: 1 },
  { id: 'skim', copies: 2 },
  { id: 'delay', copies: 1 }
]

// ---------------------------------------------------------------------------
// A DEV-ONLY DECK OVERRIDE, and nothing more.
//
// Walking one card at a time — in a browser, on a phone, or from a headless
// check — means dealing that card on purpose, which a shuffled 19-card deck
// will not do on request. So in a DEV build only, `?deck=` names a spec:
//
//     mobile.html?deck=gwarp:2,closer:1      → two Gwarps and a Closer
//     mobile.html?deck=skim                  → one Skim (copies default to 1)
//
// It is stripped from the built bundle by `import.meta.env.DEV` (Vite folds
// the branch away), it never touches the committed spec above, and the reducer
// still has the last word: resolveSpec drops ids it doesn't know and falls back
// to the house deck if nothing survives. This is a testing door, not a feature
// — the pocket version has no deck editor (§1.2) and this is not one.
// ---------------------------------------------------------------------------

function parseDeckParam(raw) {
  const spec = []
  for (const part of raw.split(',')) {
    const [id, copies] = part.split(':')
    const key = id?.trim()
    if (!key) continue
    const n = copies === undefined ? 1 : Number(copies)
    if (!Number.isFinite(n) || n < 0) continue
    spec.push({ id: key, copies: Math.floor(n) })
  }
  return spec
}

let resolved = null

export function mobileDeckSpec() {
  if (resolved) return resolved
  resolved = MOBILE_DECK_SPEC
  if (import.meta.env.DEV) {
    try {
      const raw = new URLSearchParams(window.location.search).get('deck')
      if (raw) {
        const spec = parseDeckParam(raw)
        if (spec.length > 0) {
          console.warn('[mobile] dev deck override:', spec.map((c) => `${c.id}×${c.copies}`).join(' '))
          resolved = spec
        }
      }
    } catch {
      // No URL to read (or a browser that refuses): the house deck stands.
    }
  }
  return resolved
}
