import { useEffect, useState } from 'react'
import Setup from './Setup.jsx'
import Editor from './editor/Editor.jsx'

// Top-level router. Phase 2: setup → editor.
// (The Phase 1 "Ready" screen has been removed; it was only ever a temporary
// confirmation that folders worked.)
function App() {
  const [stage, setStage] = useState('loading') // loading | setup | editor
  const [config, setConfig] = useState({ inputFolder: '', outputFolder: '', homedir: '' })

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setConfig(data)
        setStage('setup')
      })
      .catch(() => setStage('setup'))
  }, [])

  if (stage === 'loading') {
    return <div className="loading">Loading…</div>
  }

  if (stage === 'setup') {
    return (
      <Setup
        initial={config}
        onContinue={(saved) => {
          setConfig({ ...config, ...saved })
          setStage('editor')
        }}
      />
    )
  }

  return <Editor config={config} onBackToSetup={() => setStage('setup')} />
}

export default App
