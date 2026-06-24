// The deck panel renders one of:
//   - Awaiting draw  (Draw button OR a folder-error message)
//   - Card revealed  (card face + per-card Tools component + End button)
//   - Session done   (Restart button — Phase 5 will hook export here)
//
// The deck panel itself knows nothing about specific cards. It reads the
// current registry entry and renders whatever Tools component lives there.

function DeckPanel({
  state,
  poolSize,
  imageList,
  entry,
  controls,
  info,
  ready,
  exportState,
  onDraw,
  onCommit,
  onRestart,
  onOpenOutput,
  onControlChange
}) {
  if (state.phase === 'ENDGAME_DRAWN') {
    const last = state.history[state.history.length - 1]
    const status = exportState?.status ?? 'idle'
    return (
      <aside className="deck-panel endgame">
        <h2>FINISHED</h2>
        <p className="hint">
          Final card: <strong>{last?.cardId}</strong>
        </p>
        {status === 'exporting' && (
          <p className="hint">Writing PNG to your output folder…</p>
        )}
        {status === 'done' && (
          <>
            {exportState.thumbDataUrl && (
              <img src={exportState.thumbDataUrl} className="export-thumb" alt="Final composition" />
            )}
            <p className="hint">Saved to:</p>
            <p className="export-path mono">{exportState.savedPath}</p>
            <button type="button" className="secondary" onClick={onOpenOutput}>
              Open output folder
            </button>
          </>
        )}
        {status === 'error' && (
          <p className="error">Export failed: {exportState.error}</p>
        )}
        <button type="button" className="primary" onClick={onRestart}>
          Start a new composition
        </button>
      </aside>
    )
  }

  if (!state.currentCard) {
    return <AwaitingDraw imageList={imageList} poolSize={poolSize} onDraw={onDraw} />
  }

  const card = state.currentCard
  const ToolsComponent = entry?.Tools
  const commitDisabled = !ready

  return (
    <aside className="deck-panel">
      <h2>CURRENT CARD</h2>
      <div className={`card-face card-${card.kind}`}>
        <span className="card-kind">{card.kind}</span>
        <span className="card-label">{card.label}</span>
      </div>
      <div className="tool-area">
        {ToolsComponent ? (
          <ToolsComponent
            controls={controls}
            info={info}
            ready={ready}
            onControlChange={onControlChange}
          />
        ) : (
          <span className="hint">(no controls for this card)</span>
        )}
      </div>
      <button type="button" className="primary commit" onClick={onCommit} disabled={commitDisabled}>
        {commitDisabled ? 'Setting up…' : 'End — commit'}
      </button>
    </aside>
  )
}

function AwaitingDraw({ imageList, poolSize, onDraw }) {
  if (imageList.status === 'loading') {
    return (
      <aside className="deck-panel">
        <h2>THE DECK</h2>
        <p className="hint">Loading input folder…</p>
      </aside>
    )
  }
  if (imageList.status === 'error') {
    return (
      <aside className="deck-panel">
        <h2>INPUT FOLDER ERROR</h2>
        <p className="error">{imageList.error}</p>
        <p className="hint">Go back to setup to pick a different folder.</p>
      </aside>
    )
  }
  if (imageList.filenames.length === 0) {
    return (
      <aside className="deck-panel">
        <h2>NO IMAGES FOUND</h2>
        <p className="hint">
          Add some <code>.png</code> / <code>.jpg</code> / <code>.jpeg</code> /{' '}
          <code>.webp</code> files to your input folder, then reload.
        </p>
      </aside>
    )
  }
  return (
    <aside className="deck-panel">
      <h2>THE DECK</h2>
      <p className="hint">
        {poolSize} card{poolSize === 1 ? '' : 's'} eligible · {imageList.filenames.length} image
        {imageList.filenames.length === 1 ? '' : 's'} in folder
      </p>
      <button type="button" className="primary" onClick={onDraw}>
        Draw
      </button>
    </aside>
  )
}

export default DeckPanel
