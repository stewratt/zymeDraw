// Auto-start for the ML sidecar. `npm run dev` runs this alongside the
// frontend and backend; if the Python venv hasn't been set up on this
// machine (see README, "The ML sidecar"), it prints a note and exits
// cleanly — the app runs fine without ML, the cards degrade gracefully.

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const venvPython =
  process.platform === 'win32'
    ? path.join(here, '.venv', 'Scripts', 'python.exe')
    : path.join(here, '.venv', 'bin', 'python')

if (!existsSync(venvPython)) {
  console.log(
    '[ml] no venv at backend/ml/.venv — sidecar not started. ' +
      'ML cards will degrade gracefully; see README to set it up.'
  )
  process.exit(0)
}

const port = process.env.DECK_ML_PORT || '5175'
const child = spawn(
  venvPython,
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', port],
  { cwd: here, stdio: 'inherit' }
)
child.on('error', (err) => {
  console.log(`[ml] sidecar failed to start: ${err.message}`)
  process.exit(0)
})
child.on('exit', (code) => process.exit(code ?? 0))
