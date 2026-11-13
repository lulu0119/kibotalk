import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import UnoCSS from 'unocss/vite'
import { presetAttributify, presetIcons, presetWind3 } from 'unocss'
import { icons as solar } from '@iconify-json/solar'
import { traceCanvasIcons, traceIconCollection } from './trace-icons'

export default defineConfig({
  plugins: [
    react(),
    vue(),
    traceCanvasIcons(),
    UnoCSS({
      inspector: false,
      presets: [
        presetWind3({ preflight: false }),
        presetAttributify(),
        presetIcons({ collections: { mingcute: () => traceIconCollection, solar: () => solar } }),
      ],
      content: {
        filesystem: [
          'node_modules/@proj-airi/{ui,ui-trace,ui-timeline}/src/**/*.{vue,ts}',
        ],
      },
    }),
    tailwindcss(),
  ],
  resolve: { dedupe: ['react', 'react-dom'] },
  worker: { format: 'es' },
  optimizeDeps: {
    include: ['react', 'react-dom/client', '@sherpaw/speaker-diarization > @moeru/eventa > picomatch'],
    exclude: ['@proj-airi/ui', '@proj-airi/ui-trace', '@proj-airi/ui-timeline', '@sherpaw/asr', '@sherpaw/vad', '@sherpaw/preloader',
      '@sherpaw/speaker-identification', '@sherpaw/speaker-diarization'],
  },
})
