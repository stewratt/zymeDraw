import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The /api proxy is the seam between frontend (port 5173) and backend
// (port 5174). The browser sees one origin; Vite forwards anything starting
// with /api to Express. This avoids CORS during dev.
// One entry, two wings: the studio and the foundry share index.html; the
// foundry wing is a lazy chunk behind Setup's door (App.jsx).
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
  }
})
