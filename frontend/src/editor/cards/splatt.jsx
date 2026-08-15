// Splatt — the piece is cast into depth and re-photographed from somewhere
// else. Kin to the re-frame pair: the master itself becomes the object, but
// the new frame is chosen with a 3D camera instead of a 2D crop.
//
// begin sends a downscaled master to the sidecar's SHARP model and mounts the
// returned splat cloud in the card's overlay (splatView.js — the shared
// viewport). The session is one action: orbit. commit renders the live camera
// at master resolution and composites it OVER the pre-card snapshot, so the
// tears the camera opens up show the old composition through them rather than
// dead pixels — the void fill is the piece as it stood.
//
// Graceful degradation (mandatory, CLAUDE.md §3): if the sidecar is down or
// the cast fails there is no honest 2d stand-in for a depth camera, so the
// card says so and stands down — End commits the piece unchanged and the
// session moves on. It never blocks.

import { showMaster } from '../masterRaster.js'
import { CARD_TEXT } from '../cardText.js'
import { UI } from '../../copy/uiText.js'
import { frameReview } from './frameCardFactory.jsx'

const H = UI.cardHints.splatt

// The predict input. The model reads structure, not grain, so the full master
// buys nothing and costs seconds; 1536 px on the long edge is the prototype's
// profiled setting.
const PREDICT_LONG_EDGE = 1536

// The pair's review with Splatt's own reason for the wait: the commit render
// happens after the deck click, off-screen, and takes a beat.
export const splattReview = { ...frameReview, waitNote: H.rendering }

async function castToDepth(master) {
  const health = await fetch('/api/ml/health').then((r) => r.json())
  if (!health.ok || !health.splatAvailable) throw new Error('splat unavailable')

  const scale = PREDICT_LONG_EDGE / Math.max(master.width, master.height)
  const small = document.createElement('canvas')
  small.width = Math.round(master.width * scale)
  small.height = Math.round(master.height * scale)
  const g = small.getContext('2d')
  g.imageSmoothingQuality = 'high'
  g.drawImage(master, 0, 0, small.width, small.height)

  const png = await new Promise((resolve) => small.toBlob(resolve, 'image/png'))
  const res = await fetch('/api/ml/splat', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: png
  })
  if (!res.ok) throw new Error('cast failed')
  return res.blob()
}

export async function beginSplatt(ctx) {
  // The master as it stands: both what gets cast and what fills the voids at
  // commit. Held on the session because commit's ctx has no master.
  const master = ctx.master

  // The overlay is where the viewport lives, so begin has to wait for its
  // element — the same report-a-resolver handshake the grid picks use. It
  // resolves with null if the overlay goes away first (a restart).
  const container = new Promise((resolve) => ctx.report({ stage: 'casting', attach: resolve }))

  let ply
  try {
    ply = await castToDepth(master)
  } catch {
    ctx.report({ stage: 'unavailable', attach: null })
    return null
  }
  if (ctx.isCancelled?.()) return null

  const el = await container
  if (!el || ctx.isCancelled?.()) return null

  // three + the splat library are a megabyte of code that only this card ever
  // wants, so they download when one is dealt — the same deal the Plinth gets.
  // The cast has just taken seconds, so the fetch costs the session nothing.
  const { createSplatView } = await import('../splatView.js')
  const view = await createSplatView(el, ply, { isCancelled: () => !!ctx.isCancelled?.() })
  if (!view) return null // cancelled part-way through the load; it tore itself down
  // The restart could also land in the gap between the load finishing and the
  // handle reaching Editor, which would strand a live GL context.
  if (ctx.isCancelled?.()) {
    view.dispose()
    return null
  }

  ctx.report({ stage: 'live', attach: null, resetCamera: view.resetCamera })
  return { view, master }
}

export async function commitSplatt(ctx) {
  const s = ctx.session
  if (!s?.view) return // the cast failed: the piece commits unchanged
  try {
    const render = await s.view.renderAt(s.master.width, s.master.height)
    const out = document.createElement('canvas')
    out.width = s.master.width
    out.height = s.master.height
    const g = out.getContext('2d')
    g.drawImage(s.master, 0, 0) // the void fill, under everything
    g.drawImage(render, 0, 0)
    showMaster(ctx.canvas, out)
  } catch {
    // the render failed: the piece stands as it was, the session moves on
  }
  // The viewport's work is done the moment its frame is taken. Editor only
  // calls cleanup on a restart, so the workers and the GL context have to be
  // let go here or every Splatt round would leak a pair.
  await s.view.dispose()
  s.view = null
}

export function cleanupSplatt(ctx) {
  // Safe in every state — before the cast lands (no session at all), after a
  // failed cast (no view), and after commit (disposed already; idempotent).
  ctx.session?.view?.dispose()
}

// The viewport owns the canvas area for the round: the decision is spatial and
// the splat IS the piece for now. While the cast is running the piece itself
// stands in its place, so the wait is spent looking at what is being cast.
export function SplattOverlay({ info, workUrl }) {
  if (info.stage !== 'casting' && info.stage !== 'live') return null
  return (
    <div className="splatt-overlay">
      <div className="splatt-stage">
        {/* The viewport's own box: strictly the artboard's 4:5, so the frame on
            screen is the frame commit renders. The library appends its canvas
            here, so React must own no children inside it. */}
        <div className="splatt-mount" ref={(el) => info.attach?.(el)} />
        {info.stage === 'casting' && (
          <>
            {workUrl && <img className="splatt-waiting-work" src={workUrl} alt="" />}
            <p className="hint splatt-waiting-note">{H.casting}</p>
          </>
        )}
      </div>
    </div>
  )
}

export function SplattTools({ info, ready, reviewing }) {
  if (info.stage === 'casting') return <span className="hint">{H.casting}</span>
  if (info.stage === 'unavailable') return <span className="hint">{H.unavailable}</span>
  if (!ready) return <span className="hint">{UI.shared.preparing}</span>
  return (
    <div className="card-tools">
      <p className="hint">
        {reviewing ? UI.cardReview.committedNote : `${CARD_TEXT.splatt.description} ${H.live}`}
      </p>
      {!reviewing && (
        <button type="button" className="secondary" onClick={() => info.resetCamera?.()}>
          {H.reset}
        </button>
      )}
    </div>
  )
}
