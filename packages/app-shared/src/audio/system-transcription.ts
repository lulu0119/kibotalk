import type { AppLanguage } from '@kibotalk/conversation'
import type { SpeechEngine } from './speech-engine'
import type { SpeechOptions, SpeechSegment, SpeechUpdate } from './speech.worker'

type LiveTranscription = {
  input: WritableStream<Float32Array>
  partialStream: ReadableStream<string>
  text: Promise<string>
  dispose: () => Promise<void>
}

export type SystemTranscription = {
  languages: () => Promise<readonly AppLanguage[]>
  prepare: (language: AppLanguage, onProgress?: (fraction: number) => void, signal?: AbortSignal) => Promise<void>
  start: (language: AppLanguage, signal: AbortSignal) => LiveTranscription
}

type Utterance = {
  stream: LiveTranscription
  writer: WritableStreamDefaultWriter<Float32Array>
  draft: { startedAt: number; text: string }
}

function writePcm(utterance: Utterance, pcm: Float32Array) {
  // Audio resampling can overshoot the range accepted by Apple Speech.
  return utterance.writer.write(pcm.map((sample) => Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0))
}

export function withSystemTranscription(
  vad: SpeechEngine,
  start: (signal: AbortSignal) => LiveTranscription,
  signal: AbortSignal,
  options: SpeechOptions,
  laneCount: number,
): SpeechEngine {
  const lifetime = new AbortController()
  const transcriptionSignal = AbortSignal.any([signal, lifetime.signal])
  const frameDurationMs = 512 / 16
  const lookbackFrames = Math.ceil(options.minSpeechMs / frameDurationMs) + 2
  const lanes = Array.from({ length: laneCount }, () => {
    const leading: Float32Array[] = []
    let active: Utterance | undefined
    let queued = Promise.resolve()

    function enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const next = queued.then(operation)
      queued = next.then(() => {}, () => {})
      return next
    }

    function open(startedAt: number): Utterance {
      const stream = start(transcriptionSignal)
      const draft = { startedAt, text: '' }
      void stream.partialStream.pipeTo(new WritableStream<string>({
        write(text) { draft.text = text },
      })).catch(() => {}) // The write or final text promise reports stream errors.
      return { stream, writer: stream.input.getWriter(), draft }
    }

    async function finishSegments(segments: SpeechSegment[]): Promise<SpeechSegment[]> {
      const results: SpeechSegment[] = []
      for (const segment of segments) {
        const utterance = active ?? open(segment.startedAt)
        try {
          if (!active) await writePcm(utterance, segment.pcm)
          await utterance.writer.close()
          results.push({ ...segment, text: (await utterance.stream.text).trim() })
        } finally {
          active = undefined
          await utterance.stream.dispose()
        }
      }
      return results
    }

    return {
      process(index: number, pcm: Float32Array, capturedAt: number): Promise<SpeechUpdate> {
        return enqueue(async () => {
          const update = await vad.process(index, pcm.slice(), capturedAt)
          if (active) await writePcm(active, pcm)
          if (update.segments.length) {
            leading.length = 0
            return { ...update, segments: await finishSegments(update.segments) }
          }
          if (!active) {
            leading.push(pcm)
            if (leading.length > lookbackFrames) leading.shift()
            if (update.speaking) {
              active = open(capturedAt - leading.length * frameDurationMs)
              for (const frame of leading) await writePcm(active, frame)
              leading.length = 0
            }
          }
          return { ...update, draft: active && { ...active.draft } }
        })
      },
      finish: (index: number) => enqueue(async () => finishSegments(await vad.finish(index))),
      reset: (index: number) => enqueue(async () => {
        await active?.stream.dispose()
        active = undefined
        leading.length = 0
        await vad.reset(index)
      }),
    }
  })

  return {
    process: (lane, pcm, capturedAt = Date.now()) => lanes[lane].process(lane, pcm, capturedAt),
    finish: (lane) => lanes[lane].finish(lane),
    reset: (lane) => lanes[lane].reset(lane),
    dispose(reason) {
      lifetime.abort(reason)
      vad.dispose(reason)
    },
  }
}
