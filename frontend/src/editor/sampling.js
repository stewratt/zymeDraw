// Random image sampling — asks the backend for n filenames from the input
// folder, falling back to shuffling an already-loaded listing client-side
// if the endpoint fails. Shared by the opening grid and the grid cards
// (Ghost, Stamp).

export async function sampleImages(n, fallbackList = []) {
  try {
    const res = await fetch(`/api/images/sample?n=${n}`)
    const data = await res.json()
    if (data.ok && data.filenames.length > 0) return data.filenames
  } catch {
    // fall through to the client-side fallback
  }
  const pool = [...fallbackList]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(n, pool.length))
}
