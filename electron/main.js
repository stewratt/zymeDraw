import { app, BrowserWindow } from 'electron'
import { startServer } from '../backend/server.js'

// The Electron main process is a Node program, so Express runs right here —
// no child process, no fixed port. Port 0 asks the OS for any free one, which
// means the packaged app can never collide with a dev server or a second copy.

app.whenReady().then(() => {
  const server = startServer(0)
  server.once('listening', () => {
    const { port } = server.address()
    const win = new BrowserWindow({
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
