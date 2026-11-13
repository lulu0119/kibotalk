import { transfer, wrap } from 'comlink'
import { downloadTranscriptionModel, loadModelFile, vadModelFile, type TranscriptionModel } from './local-models'
import type { SpeechOptions, SpeechWorker } from './speech.worker'

export async function createSpeechEngine(
  model: TranscriptionModel | undefined,
  options: SpeechOptions,
  lanes: number,
  signal: AbortSignal,
  onDownload?: (fraction: number) => void,
) {
  const [pack, vad] = await Promise.all([
    model ? downloadTranscriptionModel(model, onDownload) : undefined,
    loadModelFile(vadModelFile),
  ])
  signal.throwIfAborted()
  const worker = new Worker(new URL('./speech.worker.ts', import.meta.url), { type: 'module' })
  const api = wrap<SpeechWorker>(worker)
  const lifetime = new AbortController()
  function dispose(reason?: unknown) {
    lifetime.abort(reason)
    worker.terminate()
    signal.removeEventListener('abort', onAbort)
  }
  function onAbort() {
    dispose(signal.reason)
  }

  worker.addEventListener('error', (event) => dispose(new Error(event.message || 'Speech worker failed')))
  signal.addEventListener('abort', onAbort, { once: true })

  function run<T>(call: () => Promise<T>): Promise<T> {
    const workerSignal = lifetime.signal
    if (workerSignal.aborted) return Promise.reject(workerSignal.reason)
    return new Promise<T>((resolve, reject) => {
      const onFailure = () => reject(workerSignal.reason)
      workerSignal.addEventListener('abort', onFailure, { once: true })
      call().then(resolve, reject).finally(() => workerSignal.removeEventListener('abort', onFailure))
    })
  }

  try {
    await run(() => api.initialize(model && pack ? { model, pack: { data: pack.data, metadata: pack.metadata } } : undefined, vad, options, lanes))
  } catch (cause) {
    dispose(cause)
    throw cause
  }
  return {
    process: (lane: number, pcm: Float32Array, capturedAt = Date.now()) =>
      run(() => api.process(lane, transfer(pcm, [pcm.buffer as ArrayBuffer]), capturedAt)),
    finish: (lane: number) => run(() => api.finish(lane)),
    reset: (lane: number) => run(() => api.reset(lane)),
    dispose,
  }
}

export type SpeechEngine = Awaited<ReturnType<typeof createSpeechEngine>>
