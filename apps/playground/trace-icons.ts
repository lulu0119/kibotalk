import { icons as solar } from '@iconify-json/solar'
import type { Plugin } from 'vite'

// AIRI's published components and trace profiles reference these icon IDs.
const solarIconsByAiriId = {
  'ai-line': 'sparkles-linear',
  'aiming-2-line': 'target-linear',
  'alert-line': 'danger-triangle-linear',
  'arrow-down-line': 'arrow-down-linear',
  'balance-line': 'stopwatch-linear',
  'bell-ringing-line': 'bell-linear',
  'braces-line': 'code-linear',
  'chat-2-line': 'chat-round-linear',
  'check-circle-fill': 'check-circle-bold',
  'check-line': 'check-linear',
  'close-circle-fill': 'close-circle-bold',
  'close-line': 'close-linear',
  'copy-2-line': 'copy-linear',
  'corner-down-right-line': 'arrow-right-down-linear',
  'corner-up-left-line': 'arrow-left-up-linear',
  'down-small-line': 'alt-arrow-down-linear',
  'download-2-line': 'download-linear',
  'edit-2-line': 'pen-linear',
  'eraser-line': 'eraser-linear',
  'eye-2-line': 'eye-linear',
  'eye-close-line': 'eye-off-linear',
  'filter-2-line': 'filter-linear',
  'fullscreen-line': 'full-screen-linear',
  'git-branch-line': 'branching-paths-down-linear',
  'information-fill': 'info-circle-bold',
  'live-line': 'play-stream-linear',
  'loading-fill': 'loader-linear',
  'message-3-line': 'chat-round-linear',
  'message-4-line': 'chat-round-linear',
  'mic-line': 'microphone-linear',
  'pause-fill': 'pause-linear',
  'play-line': 'play-linear',
  'radiobox-fill': 'record-audio-circle-linear',
  'refresh-anticlockwise-1-line': 'restart-linear',
  'right-line': 'alt-arrow-right-linear',
  'signal-line': 'chart-2-linear',
  'sound-line-line': 'soundwave-linear',
  'storage-line': 'database-linear',
  'tool-line': 'settings-linear',
  'voice-2-line': 'microphone-3-linear',
  'voice-line': 'volume-loud-linear',
  'warning-fill': 'danger-triangle-bold',
  'warning-line': 'danger-triangle-linear',
}

export const traceIconCollection = {
  prefix: 'mingcute',
  width: 24,
  height: 24,
  icons: Object.fromEntries(Object.entries(solarIconsByAiriId).map(([id, name]) => {
    const icon = solar.icons[name]
    if (!icon) throw new Error(`Missing Solar icon: ${name}`)
    return [id, icon]
  })),
}

export function traceCanvasIcons(): Plugin {
  const moduleId = '\0kibotalk:trace-canvas-icons'
  return {
    name: 'kibotalk:trace-canvas-icons',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@iconify-json/mingcute') return moduleId
    },
    load(id) {
      if (id !== moduleId) return
      // AIRI's canvas reads paint attributes directly on paths.
      const icons = Object.fromEntries(Object.entries(traceIconCollection.icons).map(([name, icon]) => {
        const body = icon.body.replace(
          /^<g (fill="none" stroke="currentColor"[^>]*)>(.*)<\/g>$/,
          (_, paint: string, children: string) => children.replaceAll('<path ', `<path ${paint} `),
        )
        return [name, { body }]
      }))
      return `export const icons = ${JSON.stringify({ icons })}`
    },
  }
}
