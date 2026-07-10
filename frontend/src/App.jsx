import { useEffect, useState } from 'react'
import Setup from './Setup.jsx'
import DeckEditor from './DeckEditor.jsx'
import Editor from './editor/Editor.jsx'
import { UI } from './copy/uiText.js'
import { loadCardSets } from './editor/cardArt.js'

// Top-level router: setup → editor, with the deck editor as a room off
// setup. The chosen deck lives here (spec: null = the house deck) and is
// handed to Editor, which seeds the reducer with it — App never holds deck
// logic, just the choice.
function App() {
  const [stage, setStage] = useState('loading') // loading | setup | deckEditor | editor
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
        onContinue={(saved) => {
          setConfig({ ...config, ...saved })
          setStage('editor')
        }}
      />
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
