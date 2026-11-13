import { wrap } from 'comlink'
import type { EmbedAudio } from '@kibotalk/speaker'
import type { SpeakerWorker } from './speaker-worker'

let embed: EmbedAudio | undefined

export function createWorkerEmbedAudio(): EmbedAudio {
  return (pcm) => {
    if (!embed) {
      const worker = new Worker(new URL('./speaker-worker.ts', import.meta.url), { type: 'module' })
      const api = wrap<SpeakerWorker>(worker)
      const failure = new Promise<never>((_, reject) => {
        worker.addEventListener('error', (event) => {
          embed = undefined
          worker.terminate()
          reject(new Error(event.message || 'Speaker worker failed'))
        })
      })
      void failure.catch(() => {})
      embed = (samples) => Promise.race([failure, api.embed(samples)])
    }
    return embed(pcm)
  }
}
