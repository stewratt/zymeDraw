// Runs the ML sidecar inside the packaged app — the counterpart of
// backend/ml/start.js, which covers `npm run dev`. Uses the Python that
// mlSetup.js installed under userData, against the packaged sidecar source,
// on a free port it announces via DECK_ML_URL (the Express proxy reads that
// per request). No environment yet → report false and do nothing; the app
// runs fine without ML.

import { spawn } from 'node:child_process'
import net from 'node:net'
import { mlPaths, mlEnv, mlSrcDir, mlStatus } from './mlSetup.js'

let child = null

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

export async function startMlSidecar(baseDir) {
  if (child) return true
  if ((await mlStatus(baseDir)) !== 'ready') return false

  const port = await freePort()
  child = spawn(
    mlPaths(baseDir).python,
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: mlSrcDir(),
      env: { ...process.env, ...mlEnv(baseDir) },
      stdio: 'inherit'
    }
  )
  child.once('error', (err) => {
    console.log(`[ml] sidecar failed to start: ${err.message}`)
    child = null
  })
  child.once('exit', (code) => {
    console.log(`[ml] sidecar exited (${code})`)
    child = null
  })

  process.env.DECK_ML_URL = `http://127.0.0.1:${port}`
  return true
}

export function stopMlSidecar() {
  if (!child) return
  child.removeAllListeners('exit')
  child.kill()
  child = null
}
