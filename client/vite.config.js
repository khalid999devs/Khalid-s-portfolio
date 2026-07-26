import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    // Three.js is an explicit, deferred enhancement. Its real gzip + GLB
    // limits are enforced by scripts/check-bundle-budget.mjs.
    chunkSizeWarningLimit: 620,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
