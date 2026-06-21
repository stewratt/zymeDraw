import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  }
})
