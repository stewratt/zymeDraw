// Wave 0 throwaway spike (to_do/mobile_plan.md §7) — delete when the wave closes.
//
// The report is the whole point of this page: Stew reads it on the phone and
// sends it back. So every measurement lands here as one plain line, and every
// uncaught error lands here too — a spike that dies silently measures nothing.

const lines = []
let el = null

export function mountReport(preEl) {
  el = preEl
  render()
}

function render() {
  if (el) el.textContent = lines.join('\n')
}

// One labelled line. Long values wrap in the <pre>; that's fine on a phone.
export function say(label, value) {
  lines.push(value === undefined ? label : `${label}: ${value}`)
  render()
  if (el) el.scrollTop = el.scrollHeight
}

export function sayBlank() {
  lines.push('')
  render()
}

export function reportText() {
  return lines.join('\n')
}

// Uncaught errors are findings, not noise — a bake that dies on the phone is
// exactly what this page exists to catch.
export function catchErrors() {
  window.addEventListener('error', (e) => {
    say('ERROR', `${e.message} (${e.filename || '?'}:${e.lineno || 0})`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    say('ERROR (promise)', describe(e.reason))
  })
}

export function describe(err) {
  if (!err) return 'unknown'
  if (typeof err === 'string') return err
  return `${err.name || 'Error'}: ${err.message || String(err)}`
}

// navigator.clipboard needs a secure context, which plain http over a tailnet
// is not — the execCommand path is the one that will actually run on the phone.
export async function copyReport() {
  const text = reportText()
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return 'clipboard'
    }
  } catch {
    // Fall through to the legacy path.
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok ? 'execCommand' : 'failed — screenshot the report instead'
}
