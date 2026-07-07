import { useEffect, useState } from 'react'
import FoundryEditor from './FoundryEditor.jsx'
import { UI } from '../copy/uiText.js'

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

  if (!config) return <div className="loading">{UI.app.loading}</div>

  if (!config.outputFolder) {
    return (
      <div className="loading">
        {UI.foundry.app.noOutputPre} <a href="/">{UI.foundry.app.noOutputLink}</a>{' '}
        {UI.foundry.app.noOutputPost}
      </div>
    )
  }

  return <FoundryEditor />
}

export default FoundryApp
