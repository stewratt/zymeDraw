import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

// This config is ESM (frontend/package.json is type: module), so there is no
// __dirname to resolve the entry files against.
const here = (file) => fileURLToPath(new URL(file, import.meta.url))

// The /api proxy is the seam between frontend (port 5173) and backend
// (port 5174). The browser sees one origin; Vite forwards anything starting
// with /api to Express. This avoids CORS during dev.
// TWO ENTRIES, three wings: index.html is the desktop app (the studio and the
// foundry, the foundry behind a lazy chunk in Setup's door), and mobile.html
// is the pocket version (mobile_plan.md §5 — its own shell over the same
// shared core). One `vite build` emits both; neither imports the other's
// shell, so the mobile bundle carries no desktop layout and no Foundry.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: here('./index.html'),
        mobile: here('./mobile.html')
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true
      }
    }
  }
})
