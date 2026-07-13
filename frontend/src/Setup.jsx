import { useEffect, useState } from 'react'
import { UI, fmt } from './copy/uiText.js'
import { rich } from './copy/rich.jsx'
import { loadCardSets, setActiveCardSet, useActiveCardSet, useCardSets } from './editor/cardArt.js'
import { MOD_CARDS } from './editor/deck.js'

const T = UI.setup

function Setup({ initial, deckName, deckSpec, onOpenDeckEditor, onContinue }) {
  const [inputFolder, setInputFolder] = useState(initial.inputFolder || '')
  const [outputFolder, setOutputFolder] = useState(initial.outputFolder || '')
  const [errors, setErrors] = useState({ inputFolder: null, outputFolder: null })
  const [submitting, setSubmitting] = useState(null) // 'editor' | 'foundry' | null
  // Which field's native folder dialog is currently open (disables both Browse
  // buttons meanwhile), plus a per-field note if the picker isn't available.
  const [picking, setPicking] = useState(null) // 'input' | 'output' | 'cards' | null
  const [pickNote, setPickNote] = useState({ inputFolder: null, outputFolder: null })

  // Card faces (optional): the folder + the chosen set live in the shared
  // card-art store, so switching updates every dealt card live. The path is
  // editable (hand-typed paths work where the OS picker is absent — Linux);
  // it commits to the backend on blur or after Browse.
  const { sets, folder: cardsFolder } = useCardSets()
  const activeSet = useActiveCardSet()
  const [cardsPath, setCardsPath] = useState('')
  useEffect(() => {
    if (cardsFolder) setCardsPath(cardsFolder)
  }, [cardsFolder])

  // Ask the backend to open the OS folder picker and drop the chosen absolute
  // path into the field. Cancel = leave the field alone; no picker = a note
  // telling the user to type the path (the input stays fully usable).
  async function browse(which) {
    const key = which === 'input' ? 'inputFolder' : 'outputFolder'
    setPicking(which)
    setPickNote((n) => ({ ...n, [key]: null }))
    try {
      const res = await fetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: which === 'input' ? 'read' : 'write',
          current: which === 'input' ? inputFolder : outputFolder
        })
      })
      const data = await res.json()
      if (data.ok && data.path) {
        if (which === 'input') setInputFolder(data.path)
        else setOutputFolder(data.path)
      } else if (!data.ok) {
        setPickNote((n) => ({ ...n, [key]: data.error || T.pickerFailed }))
      }
    } catch (err) {
      setPickNote((n) => ({ ...n, [key]: fmt(T.pickerFailedDetail, { message: err.message }) }))
    } finally {
      setPicking(null)
    }
  }

  // Persist a card-faces folder to the backend, then re-list its sets. An
  // empty/invalid path is left to the backend to reject; the built-in faces
  // stay in place either way.
  async function commitCardsFolder(path) {
    if (!path.trim()) return
    try {
      await fetch('/api/cardsets-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      })
      await loadCardSets()
    } catch {
      // No backend = built-in faces only. Never blocks setup.
    }
  }

  // Open the OS folder picker, or fall through to the hand-typed path.
  async function browseCards() {
    setPicking('cards')
    try {
      const picked = await fetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'read', current: cardsPath || '' })
      }).then((r) => r.json())
      if (picked.ok && picked.path) {
        setCardsPath(picked.path)
        await commitCardsFolder(picked.path)
      }
    } catch {
      // A missing picker leaves the field for hand-typing.
    } finally {
      setPicking(null)
    }
  }

  const homedir = initial.homedir || ''
  const inputHint = homedir ? fmt(T.inputPlaceholder, { home: homedir }) : T.inputPlaceholderNoHome
  const outputHint = homedir ? fmt(T.outputPlaceholder, { home: homedir }) : T.outputPlaceholderNoHome

  // Both doors — the studio session and the foundry — run the same
  // validate-and-persist submit; only the destination wing differs.
  async function submit(wing) {
    setSubmitting(wing)
    setErrors({ inputFolder: null, outputFolder: null })
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputFolder, outputFolder })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrors({
          inputFolder: data.inputFolder?.error ?? null,
          outputFolder: data.outputFolder?.error ?? null
        })
        return
      }
      onContinue(
        {
          inputFolder: data.inputFolder,
          outputFolder: data.outputFolder
        },
        wing
      )
    } catch (err) {
      setErrors({
        inputFolder: fmt(T.networkError, { message: err.message }),
        outputFolder: null
      })
    } finally {
      setSubmitting(null)
    }
  }

  const canSubmit = !submitting && inputFolder.trim() && outputFolder.trim()

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault()
        submit('editor')
      }}
    >
      <h1 className="setup-logo">
        <img src="/logo/zyme.png" alt={T.title} />
      </h1>
      <p className="muted">{T.subtitle}</p>

      <label className="field">
        <span className="field-label">{T.inputLabel}</span>
        <div className="field-row">
          <input
            type="text"
            value={inputFolder}
            onChange={(e) => setInputFolder(e.target.value)}
            placeholder={inputHint}
            spellCheck={false}
            autoFocus
            aria-invalid={!!errors.inputFolder}
          />
          <button
            type="button"
            className="browse"
            onClick={() => browse('input')}
            disabled={picking !== null}
          >
            {picking === 'input' ? T.browseOpening : T.browse}
          </button>
        </div>
        <small className="hint">{T.inputHint}</small>
        {pickNote.inputFolder && <small className="hint">{pickNote.inputFolder}</small>}
        {errors.inputFolder && <small className="error">{errors.inputFolder}</small>}
      </label>

      <label className="field">
        <span className="field-label">{T.outputLabel}</span>
        <div className="field-row">
          <input
            type="text"
            value={outputFolder}
            onChange={(e) => setOutputFolder(e.target.value)}
            placeholder={outputHint}
            spellCheck={false}
            aria-invalid={!!errors.outputFolder}
          />
          <button
            type="button"
            className="browse"
            onClick={() => browse('output')}
            disabled={picking !== null}
          >
            {picking === 'output' ? T.browseOpening : T.browse}
          </button>
        </div>
        <small className="hint">{T.outputHint}</small>
        {pickNote.outputFolder && <small className="hint">{pickNote.outputFolder}</small>}
        {errors.outputFolder && <small className="error">{errors.outputFolder}</small>}
      </label>

      <label className="field">
        <span className="field-label">{T.cardSetsLabel}</span>
        <div className="field-row">
          <input
            type="text"
            value={cardsPath}
            onChange={(e) => setCardsPath(e.target.value)}
            onBlur={() => cardsPath.trim() && cardsPath !== cardsFolder && commitCardsFolder(cardsPath)}
            placeholder={T.cardSetsPlaceholder}
            spellCheck={false}
          />
          <button
            type="button"
            className="browse"
            onClick={browseCards}
            disabled={picking !== null}
          >
            {picking === 'cards' ? T.browseOpening : T.browse}
          </button>
        </div>
        <small className="hint">{T.cardSetsHint}</small>
        {cardsFolder && sets.length === 0 && <small className="hint">{T.cardSetsEmpty}</small>}
        {sets.length > 0 && (
          <div className="field-row">
            <span className="field-label">{T.cardSetsSetLabel}</span>
            <select value={activeSet || ''} onChange={(e) => setActiveCardSet(e.target.value)}>
              <option value="">{T.cardSetsBuiltin}</option>
              {sets.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.ids.length})
                </option>
              ))}
            </select>
          </div>
        )}
      </label>

      <div className="field">
        <span className="field-label">{T.deckLabel}</span>
        <div className="field-row deck-row">
          <span className="deck-name">
            {fmt(T.deckLine, {
              name: deckName,
              count: (deckSpec ?? MOD_CARDS).reduce((sum, c) => sum + c.copies, 0)
            })}
          </span>
          <button type="button" className="browse" onClick={onOpenDeckEditor}>
            {T.deckEditorButton}
          </button>
        </div>
      </div>

      <div className="setup-doors">
        <button type="submit" disabled={!canSubmit}>
          {submitting === 'editor' ? T.continueChecking : T.continue}
        </button>
        <button type="button" className="door-foundry" disabled={!canSubmit} onClick={() => submit('foundry')}>
          {submitting === 'foundry' ? T.continueChecking : T.foundryDoor}
        </button>
      </div>

      <p className="footnote">{rich(T.footnote)}</p>
    </form>
  )
}

export default Setup
