import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The /api proxy is the seam between frontend (port 5173) and backend
// (port 5174). The browser sees one origin; Vite forwards anything starting
// with /api to Express. This avoids CORS during dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true
      }
    }
  },
  // Two apps, one package: Deck at / and Foundry at /foundry.html
  // (card_maker.md §1). Dev serves both with no config; build needs each
  // HTML entry listed.
  build: {
    rollupOptions: {
      input: {
        deck: fileURLToPath(new URL('./index.html', import.meta.url)),
        foundry: fileURLToPath(new URL('./foundry.html', import.meta.url))
      }
    }
  }
})
