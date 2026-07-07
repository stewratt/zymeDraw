import { useEffect, useState } from 'react'
import FoundryEditor from './FoundryEditor.jsx'

// Foundry's top level. No Setup screen of its own — folders are configured
// in Deck's Setup and persisted to ~/.deck-config.json; Foundry only checks
// that an output folder exists so the Proof's export has somewhere to land.
function FoundryApp() {
  const [config, setConfig] = useState(null) // null while loading

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({}))
  }, [])

  if (!config) return <div className="loading">Loading…</div>

  if (!config.outputFolder) {
    return (
      <div className="loading">
        No output folder configured — open <a href="/">Deck</a> once and set
        your folders in Setup, then reload Foundry.
      </div>
    )
  }

  return <FoundryEditor />
}

export default FoundryApp
