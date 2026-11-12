import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rendererRoot = resolve(import.meta.dirname, 'src/renderer')

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: rendererRoot,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: resolve(import.meta.dirname, 'out/renderer'),
      rollupOptions: {
        input: {
          island: resolve(rendererRoot, 'index.html'),
          onboarding: resolve(rendererRoot, 'onboarding.html'),
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          ws: true,
        },
      },
    },
  },
})
