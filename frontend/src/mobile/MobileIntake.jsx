// Intake — the pocket version's Setup, and the only screen before the deck.
//
// Two legs, either or both (mobile_plan.md §2.2): a zymebox folder, read
// straight from the phone with no backend in the middle, and the phone's own
// photos. The pool the session deals from is their union, so a folder you
// can't reach today is a session you can still have with what's in your
// camera roll — and a folder you can reach is a session with the studio's
// images on the bus.
//
// The folder URL is remembered on this phone (localStorage, best-effort — a
// private window that refuses storage must still be able to run a session).

import { useEffect, useRef, useState } from 'react'
import { TUNING } from '../editor/deck.js'
import { addPhotos, photoCount, poolCount, readFolder } from './imageSources.js'
import { UI, fmt } from '../copy/uiText.js'

const M = UI.mobile
const STORAGE_KEY = 'zyme.mobile.folder'

function readStoredFolder() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeFolder(url) {
  try {
    localStorage.setItem(STORAGE_KEY, url)
  } catch {
    // A browser that refuses storage costs the convenience, never the session.
  }
}

function MobileIntake({ onBegin }) {
  const [url, setUrl] = useState(readStoredFolder)
  const [folder, setFolder] = useState({ status: 'idle', count: 0, via: null, error: null })
  const [photos, setPhotos] = useState({ status: 'idle', count: 0, error: null })
  const fileRef = useRef(null)

  // The pool the session will see — both legs, counted once.
  const [pool, setPool] = useState(() => poolCount())
  useEffect(() => {
    setPool(poolCount())
  }, [folder, photos])

  async function handleReadFolder() {
    setFolder({ status: 'reading', count: 0, via: null, error: null })
    try {
      const { count, via } = await readFolder(url)
      storeFolder(url.trim())
      setFolder({ status: count > 0 ? 'ok' : 'empty', count, via, error: null })
    } catch (err) {
      setFolder({ status: 'error', count: 0, via: null, error: err.message })
    }
  }

  async function handlePhotos(event) {
    const files = [...(event.target.files ?? [])]
    // Let the same photo be picked again later: the input keeps no state.
    event.target.value = ''
    if (files.length === 0) return
    setPhotos((prev) => ({ ...prev, status: 'reading', error: null }))
    const { errors } = await addPhotos(files)
    setPhotos({
      status: 'ok',
      count: photoCount(),
      error: errors.length > 0 ? fmt(M.photosFailed, { error: errors[0] }) : null
    })
  }

  const ready = pool >= 2
  const thin = ready && pool < TUNING.openingGrid

  return (
    <div className="m-intake">
      <header className="m-intake-head">
        <h1>{UI.setup.title}</h1>
        <p className="hint">{M.intakeSubtitle}</p>
      </header>

      <section className="m-intake-leg">
        <h2>{M.folderLabel}</h2>
        <p className="hint">{M.folderHint}</p>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder={M.folderPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          className="secondary"
          disabled={folder.status === 'reading' || url.trim() === ''}
          onClick={handleReadFolder}
        >
          {folder.status === 'reading' ? M.folderReading : M.folderRead}
        </button>
        {folder.status === 'ok' && (
          <p className="hint">{fmt(M.folderFound, { count: folder.count, via: folder.via })}</p>
        )}
        {folder.status === 'empty' && <p className="hint">{M.folderEmpty}</p>}
        {folder.status === 'error' && <p className="error">{folder.error}</p>}
      </section>

      <section className="m-intake-leg">
        <h2>{M.photosLabel}</h2>
        <p className="hint">{M.photosHint}</p>
        <input
          ref={fileRef}
          className="m-file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotos}
        />
        <button
          type="button"
          className="secondary"
          disabled={photos.status === 'reading'}
          onClick={() => fileRef.current?.click()}
        >
          {photos.status === 'reading' ? M.photosReading : M.photosButton}
        </button>
        {photos.count > 0 && <p className="hint">{fmt(M.photosAdded, { count: photos.count })}</p>}
        {photos.error && <p className="error">{photos.error}</p>}
      </section>

      <footer className="m-intake-foot">
        <p className="hint">
          {pool === 0 ? M.poolEmpty : fmt(M.poolLine, { count: pool })}
          {!ready && pool > 0 ? ` · ${M.needTwo}` : ''}
        </p>
        {thin && <p className="hint">{fmt(M.poolThin, { total: TUNING.openingGrid })}</p>}
        <button type="button" className="primary" disabled={!ready} onClick={onBegin}>
          {M.begin}
        </button>
      </footer>
    </div>
  )
}

export default MobileIntake
