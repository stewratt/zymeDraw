import { useEffect, useState } from 'react'
import { UI } from './copy/uiText.js'

const T = UI.mlSetup

// The first-launch machine-tools screen (Electron only). Mounting it starts
// the install; it polls /api/ml/setup and leaves through one of three doors:
// onDone when the environment is ready (or the user lets it finish in the
// background), onSkip when they decline after a failure. The install itself
// lives in the Electron main process — closing this screen abandons nothing.
function MlSetup({ onDone, onSkip }) {
  const [status, setStatus] = useState({ state: 'running', phase: 'python', pct: 0 })

  useEffect(() => {
    let timer
    let stopped = false
    const poll = async () => {
      try {
        const data = await fetch('/api/ml/setup').then((r) => r.json())
        if (stopped) return
        setStatus(data)
        if (data.state === 'ready' || data.state === 'unmanaged') {
          onDone()
          return
        }
      } catch {
        // Backend hiccup — keep polling; the install runs independently.
      }
      timer = setTimeout(poll, 700)
    }
    fetch('/api/ml/setup', { method: 'POST' })
      .catch(() => {})
      .finally(poll)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [onDone])

  async function retry() {
    setStatus({ state: 'running', phase: 'python', pct: 0 })
    await fetch('/api/ml/setup', { method: 'POST' }).catch(() => {})
  }

  const failed = status.state === 'error'

  // One bar for the whole fitting: engine 0–35%, parts hold at 50% (pip
  // reports lines, not fractions — the bar pulses), models 50–100%.
  const fill =
    status.phase === 'python'
      ? (status.pct ?? 0) * 0.35
      : status.phase === 'packages'
        ? 0.5
        : 0.5 + (status.pct ?? 0) * 0.5
  const phaseLabel = {
    python: T.phasePython,
    packages: T.phasePackages,
    weights: T.phaseWeights
  }[status.phase]
  // pip narrates in long lines full of absolute paths — keep the first
  // clause ("Collecting fastapi>=0.115") and drop the rest.
  const detail = (status.message ?? '').replace(/\s*\(from.*$/, '').slice(0, 60)

  return (
    <div className="setup ml-setup">
      <h1 className="setup-logo">
        <img src="/logo/zyme.png" alt={UI.setup.title} />
      </h1>

      {failed ? (
        <>
          <p>{T.errorTitle}</p>
          {status.error && <small className="error">{status.error}</small>}
          <p className="muted">{T.errorHint}</p>
          <div className="setup-doors">
            <button type="button" onClick={retry}>
              {T.retry}
            </button>
            <button type="button" onClick={onSkip}>
              {T.skip}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{T.title}</p>
          <p className="muted">{T.body}</p>
          <div className="ml-progress">
            <div
              className={'ml-progress-fill' + (status.phase === 'packages' ? ' pulsing' : '')}
              style={{ width: `${Math.round(fill * 100)}%` }}
            />
          </div>
          <small className="hint">
            {phaseLabel}
            {detail ? ` ${detail}` : ''}
          </small>
          <div className="setup-doors">
            <button type="button" onClick={onDone}>
              {T.continueBehind}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default MlSetup
