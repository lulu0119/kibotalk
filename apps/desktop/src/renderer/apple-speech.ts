import type { SystemTranscription } from '@kibotalk/app-shared'
import type { AppLanguage } from '@kibotalk/conversation'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { createAppleSpeechProvider } from '@xsai-apple-speech/transcription-electron-plugin'
import { APPLE_SPEECH_IPC } from '../shared/ipc'

const transport = window.kibotalk.appleSpeechTransport
// Eventa types the full Electron bridge but uses only send and on for this adapter.
const ipc = {
  send: (_channel: string, payload: unknown) => transport.send(payload),
  on: (_channel: string, callback: (event: undefined, payload: unknown) => void) =>
    transport.subscribe((payload) => callback(undefined, payload)),
}
const { context, dispose } = createContext(ipc as unknown as Parameters<typeof createContext>[0], {
  messageEventName: APPLE_SPEECH_IPC,
  errorEventName: false,
})
window.addEventListener('pagehide', () => dispose(), { once: true })
const provider = createAppleSpeechProvider({ context })
const locales: Record<AppLanguage, string> = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' }
let supportedLanguages: Promise<AppLanguage[]> | undefined

export const desktopTranscription: SystemTranscription = {
  languages() {
    if (!transport.supportedSystem) return Promise.resolve([])
    return supportedLanguages ??= provider.getLocales().then((available) => {
      const tags = new Set(available.map(({ locale }) => locale))
      return (Object.keys(locales) as AppLanguage[]).filter((language) => tags.has(locales[language]))
    }).catch(() => [])
  },
  prepare(language, onProgress, signal) {
    return provider.load({
      locale: locales[language],
      abortSignal: signal,
      onProgress: (event) => onProgress?.(event.status === 'ready' ? 1 : event.progress),
    })
  },
  start(language, signal) {
    return provider.transcription({ locale: locales[language] }).startStream({
      abortSignal: signal,
      inputSampleRate: 16000,
    })
  },
}
