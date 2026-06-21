import { useState } from 'react'

function Setup({ initial, onContinue }) {
  const [inputFolder, setInputFolder] = useState(initial.inputFolder || '')
  const [outputFolder, setOutputFolder] = useState(initial.outputFolder || '')
  const [errors, setErrors] = useState({ inputFolder: null, outputFolder: null })
  const [submitting, setSubmitting] = useState(false)

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
      <p className="muted">Phase 1 — choose folders</p>

      <label className="field">
        <span className="field-label">Input folder</span>
        <input
          type="text"
          value={inputFolder}
          onChange={(e) => setInputFolder(e.target.value)}
          placeholder={inputHint}
          spellCheck={false}
          autoFocus
          aria-invalid={!!errors.inputFolder}
        />
        <small className="hint">Where the source images live (read-only).</small>
        {errors.inputFolder && <small className="error">{errors.inputFolder}</small>}
      </label>

      <label className="field">
        <span className="field-label">Output folder</span>
        <input
          type="text"
          value={outputFolder}
          onChange={(e) => setOutputFolder(e.target.value)}
          placeholder={outputHint}
          spellCheck={false}
          aria-invalid={!!errors.outputFolder}
        />
        <small className="hint">Where finished compositions will be saved.</small>
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
