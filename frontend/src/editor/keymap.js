// keymap.js — the one keyboard dispatcher (hotkeys.md §7).
//
// Editor builds a flat array of bindings each render, ordered most-specific
// scope first (card accents → brush grammar → arrange → global), and one
// persistent keydown listener walks it: the first binding that matches the
// event runs and consumes it. A binding's run may return `false` to say
// "not mine after all" (Etch's Enter only acts at the frame stage) and the
// walk continues — preventDefault fires only for the binding that handled.
//
// A binding: { key?, code?, shift?, mod?, run }
//   key   — matched against e.key, case-insensitively ('r' matches R)
//   code  — matched against e.code, for physical keys whose e.key changes
//           under Shift ('[' becomes '{'): BracketLeft, Comma, Minus…
//   shift — true/false requires Shift held/absent; omit to accept either
//           (run receives the event, so steps can scale with e.shiftKey)
//   mod   — true requires Cmd/Ctrl (the undo family); omitted forbids it
//
// Form fields always win (hotkeys.md §1.5): while focus is in an input,
// textarea, select or contenteditable, nothing dispatches — native slider
// arrows, color typing etc. behave normally. Alt combos never dispatch
// (Firefox's menu bar, macOS Option characters).

export function isFormTarget(e) {
  const t = e.target
  const tag = t?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t?.isContentEditable
}

function matches(b, e) {
  if (e.altKey) return false
  const mod = e.metaKey || e.ctrlKey
  if (b.mod ? !mod : mod) return false
  if (b.shift !== undefined && e.shiftKey !== b.shift) return false
  if (b.code) return e.code === b.code
  if (b.key) return e.key.toLowerCase() === b.key.toLowerCase()
  return false
}

export function dispatchKey(bindings, e) {
  if (isFormTarget(e)) return false
  for (const b of bindings) {
    if (!matches(b, e)) continue
    if (b.run(e) === false) continue
    e.preventDefault()
    return true
  }
  return false
}
