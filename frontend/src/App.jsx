import { Suspense, lazy, useEffect, useState } from 'react'
import Setup from './Setup.jsx'
import DeckEditor from './DeckEditor.jsx'
import Editor from './editor/Editor.jsx'
import { UI } from './copy/uiText.js'
import { loadCardSets } from './editor/cardArt.js'

// The foundry wing — lazy so its weight (plates, fonts, type layer) only
// downloads when its door is opened from Setup.
const FoundryEditor = lazy(() => import('./foundry/FoundryEditor.jsx'))

// Top-level router: setup → editor, with the deck editor as a room off
// setup and the foundry as the second wing. Setup is the shell — both
// wings return to it between sessions; there is no mid-session crossing.
// The chosen deck lives here (spec: null = the house deck) and is handed
// to Editor, which seeds the reducer with it — App never holds deck
// logic, just the choice.
function App() {
  const [stage, setStage] = useState('loading') // loading | setup | deckEditor | editor | foundry
  const [config, setConfig] = useState({ inputFolder: '', outputFolder: '', homedir: '', decks: [] })
  const [deck, setDeck] = useState({ spec: null, name: UI.deckEditor.houseDeckName })

  useEffect(() => {
    loadCardSets() // populate the card-set store; faces resolve before Setup
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setConfig({ decks: [], ...data })
        setStage('setup')
      })
      .catch(() => setStage('setup'))
  }, [])

  if (stage === 'loading') {
    return <div className="loading">{UI.app.loading}</div>
  }

  if (stage === 'setup') {
    return (
      <Setup
        initial={config}
        deckName={deck.name}
        deckSpec={deck.spec}
        onOpenDeckEditor={() => setStage('deckEditor')}
        onContinue={(saved, wing = 'editor') => {
          setConfig({ ...config, ...saved })
          setStage(wing)
        }}
      />
    )
  }

  if (stage === 'foundry') {
    return (
      <Suspense fallback={<div className="loading">{UI.app.loading}</div>}>
        <FoundryEditor onBackToSetup={() => setStage('setup')} />
      </Suspense>
    )
  }

  if (stage === 'deckEditor') {
    return (
      <DeckEditor
        decks={config.decks ?? []}
        active={deck}
        onUse={(spec, name) => {
          setDeck({ spec, name })
          setStage('setup')
        }}
        onBack={() => setStage('setup')}
        onDecksSaved={(decks) => setConfig((c) => ({ ...c, decks }))}
      />
    )
  }

  return <Editor config={config} deckSpec={deck.spec} onBackToSetup={() => setStage('setup')} />
}

export default App
