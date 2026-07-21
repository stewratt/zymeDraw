import { app, BrowserWindow, dialog, shell } from 'electron'
import { startServer, setNativeHooks } from '../backend/server.js'

// The Electron main process is a Node program, so Express runs right here —
// no child process, no fixed port. Port 0 asks the OS for any free one, which
// means the packaged app can never collide with a dev server or a second copy.

let win = null

// Electron's own dialog and shell replace the spawned-command fallbacks
// (zenity/kdialog, xdg-open …) — same JSON shapes the API routes already
// return, so the frontend can't tell the difference.
setNativeHooks({
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
