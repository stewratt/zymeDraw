import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

// The config lives in the user's home directory, NOT in the repo.
// Each machine (Linux, Mac, Windows) has its own — paths differ per OS.
const CONFIG_PATH = path.join(os.homedir(), '.deck-config.json')

const EMPTY = { inputFolder: '', outputFolder: '', platesFolder: '', panelArtFolder: '', cardsetsFolder: '' }

export async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return { ...EMPTY, ...parsed }
  } catch {
    // Missing or unreadable config = "no saved paths yet." Not an error.
    return { ...EMPTY }
  }
}

// Merges over what's already on disk, so a partial save (Deck's Setup
// writing input/output, Foundry writing platesFolder) never drops the
// other app's keys.
export async function saveConfig(config) {
  const next = { ...(await loadConfig()), ...config }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export { CONFIG_PATH }
