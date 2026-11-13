import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        app: 'index.html',
      },
    },
  },
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['@sherpaw/asr', '@sherpaw/vad', '@sherpaw/preloader', '@sherpaw/speaker-identification'],
  },
})
