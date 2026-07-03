import { useState } from 'react'

function Setup({ initial, onContinue }) {
  const [inputFolder, setInputFolder] = useState(initial.inputFolder || '')
  const [outputFolder, setOutputFolder] = useState(initial.outputFolder || '')
  const [errors, setErrors] = useState({ inputFolder: null, outputFolder: null })
  const [submitting, setSubmitting] = useState(false)
  // Which field's native folder dialog is currently open (disables both Browse
  // buttons meanwhile), plus a per-field note if the picker isn't available.
  const [picking, setPicking] = useState(null) // 'input' | 'output' | null
  const [pickNote, setPickNote] = useState({ inputFolder: null, outputFolder: null })

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
        setPickNote((n) => ({ ...n, [key]: data.error || 'Could not open a folder picker.' }))
      }
    } catch (err) {
      setPickNote((n) => ({ ...n, [key]: `Could not open a folder picker: ${err.message}` }))
    } finally {
      setPicking(null)
    }
  }

  const homedir = initial.homedir || ''
  const inputHint = homedir ? `e.g. ${homedir}/Pictures/deck-input` : 'absolute path to your input folder'
  const outputHint = homedir ? `e.g. ${homedir}/Pictures/deck-output` : 'absolute path to your output folder'

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
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
      onContinue({
        inputFolder: data.inputFolder,
        outputFolder: data.outputFolder
      })
    } catch (err) {
      setErrors({
        inputFolder: `Network error: ${err.message}`,
        outputFolder: null
      })
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !submitting && inputFolder.trim() && outputFolder.trim()

  return (
    <form className="setup" onSubmit={handleSubmit}>
      <h1>DECK</h1>
      <p className="muted">Choose your folders</p>

      <label className="field">
        <span className="field-label">Input folder</span>
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
            {picking === 'input' ? 'Opening…' : 'Browse…'}
          </button>
        </div>
        <small className="hint">Where the source images live (read-only).</small>
        {pickNote.inputFolder && <small className="hint">{pickNote.inputFolder}</small>}
        {errors.inputFolder && <small className="error">{errors.inputFolder}</small>}
      </label>

      <label className="field">
        <span className="field-label">Output folder</span>
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
            {picking === 'output' ? 'Opening…' : 'Browse…'}
          </button>
        </div>
        <small className="hint">Where finished compositions will be saved.</small>
        {pickNote.outputFolder && <small className="hint">{pickNote.outputFolder}</small>}
        {errors.outputFolder && <small className="error">{errors.outputFolder}</small>}
      </label>

      <button type="submit" disabled={!canSubmit}>
        {submitting ? 'Checking…' : 'Continue'}
      </button>

      <p className="footnote">
        Paths support a leading <code>~</code> for your home directory. Folders must exist before continuing.
      </p>
    </form>
  )
}

export default Setup
