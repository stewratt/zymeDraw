import { app, BrowserWindow, dialog, shell } from 'electron'
import { startServer, setNativeHooks } from '../backend/server.js'
import { startMlSidecar, stopMlSidecar } from './mlSidecar.js'
import { mlStatus, runMlSetup } from './mlSetup.js'

// The Electron main process is a Node program, so Express runs right here —
// no child process, no fixed port. Port 0 asks the OS for any free one, which
// means the packaged app can never collide with a dev server or a second copy.

let win = null

// Electron's own dialog and shell replace the spawned-command fallbacks
// (zenity/kdialog, xdg-open …) — same JSON shapes the API routes already
// return, so the frontend can't tell the difference.
// First-launch ML install, exposed to the frontend via /api/ml/setup.
// One install at a time; the latest progress event is the whole status —
// the frontend polls rather than streams, boring on purpose.
let mlRun = null // { state:'running', phase, pct?, message? } while installing
let mlError = null

setNativeHooks({
  async mlSetupStatus() {
    if (mlRun) return mlRun
    if (mlError) return { state: 'error', error: mlError }
    return { state: await mlStatus(app.getPath('userData')) }
  },
  async mlSetupStart() {
    if (mlRun) return mlRun
    const state = await mlStatus(app.getPath('userData'))
    if (state !== 'missing') return { state }
    mlError = null
    mlRun = { state: 'running', phase: 'python', pct: 0 }
    runMlSetup(app.getPath('userData'), (ev) => {
      mlRun = { state: 'running', ...ev }
    }).then((result) => {
      mlRun = null
      if (result.ok) startMlSidecar(app.getPath('userData'))
      else mlError = result.error
    })
    return mlRun
  },
  async pickFolder(prompt, startDir) {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: prompt,
      message: prompt,
      defaultPath: startDir,
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths.length) return { ok: true, path: null, cancelled: true }
    return { ok: true, path: filePaths[0] }
  },
  async openFolder(folder) {
    const err = await shell.openPath(folder)
    return err ? { ok: false, error: err } : { ok: true }
  }
})

app.whenReady().then(() => {
  // Fire-and-forget: if the userData ML environment exists it comes up in
  // the background; if not (fresh machine, skipped setup) this is a no-op
  // and the ML cards degrade gracefully.
  startMlSidecar(app.getPath('userData'))
  const server = startServer(0)
  server.once('listening', () => {
    const { port } = server.address()
    win = new BrowserWindow({
      width: 1440,
      height: 940,
      autoHideMenuBar: true,
      backgroundColor: '#1a1a1a'
    })
    win.loadURL(`http://localhost:${port}`)
  })
})

// Deck without a window has nothing to do — quit on close, all platforms.
app.on('window-all-closed', () => {
  app.quit()
})

// uvicorn is a real child process — without this it would outlive the app.
app.on('will-quit', () => {
  stopMlSidecar()
})
