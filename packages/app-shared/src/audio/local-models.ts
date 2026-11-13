import type { AppLanguage } from '@kibotalk/conversation'
import { createStore, get, set } from 'idb-keyval'

export type TranscriptionModel = {
  id: string
  name: string
  languages: readonly AppLanguage[]
  recognizer: 'transducer' | 'paraformer'
  modelingUnit: 'cjkchar' | ''
  files: readonly [ModelFile & { bytes: number }, ModelFile]
}

type ModelFile = { url: string; bytes?: number; bundledName?: string }

function modelPack(repository: string, revision: string, bytes: number): TranscriptionModel['files'] {
  const directory = `https://huggingface.co/moeru-ai/${repository}/resolve/${revision}/install/bin/wasm`
  return [{ url: `${directory}/preload.data`, bytes }, { url: `${directory}/preload.js.metadata` }]
}

// Keep model IDs, pack revisions and recognizer settings aligned with AIRI's Sherpaw catalogue.
export const transcriptionModels: readonly TranscriptionModel[] = [
  {
    id: 'zipformer-multilingual',
    name: 'Zipformer',
    languages: ['zh', 'en', 'ja'],
    recognizer: 'transducer',
    modelingUnit: 'cjkchar',
    files: modelPack('sherpa-onnx-streaming-zipformer-ar_en_id_ja_ru_th_vi_zh-2025-02-10',
      'fce043ac9738950d5cd223955b86656bfaa42311', 338873347),
  },
  {
    id: 'x-asr-zh-en-480ms-int8',
    name: 'X-ASR 480 ms (INT8)',
    languages: ['zh', 'en'],
    recognizer: 'transducer',
    modelingUnit: '',
    files: modelPack('sherpaw-x-asr-zh-en-480ms-int8', 'd9ab70a45493b97ae76e08574fcbc5ad0c5d0039', 169227953),
  },
  {
    id: 'paraformer-zh-en',
    name: 'Paraformer',
    languages: ['zh', 'en'],
    recognizer: 'paraformer',
    modelingUnit: 'cjkchar',
    files: modelPack('sherpaw-paraformer-zh-en', '46701cc733a82ed5cb94c7f3200a002d010243f6', 237202501),
  },
]

export const speakerModelId = 'sherpaw-campplus-zh-en-advanced'
export const speakerModelRevision = '5fc23543ac94200ae77514cf1c40596c5d70f6e8'
export const speakerModelFile = {
  ...modelPack(speakerModelId, speakerModelRevision, 28281164)[0],
  bundledName: `${speakerModelId}-${speakerModelRevision}.onnx`,
}
export const vadModelFile = {
  url: 'https://raw.githubusercontent.com/snakers4/silero-vad/v5.1.2/src/silero_vad/data/silero_vad.onnx',
  bytes: 2327524,
  bundledName: 'silero-vad-v5.1.2.onnx',
}
export const baseSpeechModelFiles = [vadModelFile, speakerModelFile] as const
export const BUNDLED_MODEL_SCHEME = 'kibotalk-model'

const MODEL_KEY = 'kibotalk.transcriptionModel'

export const systemTranscriptionOption = { id: 'apple-speech', name: 'Apple Speech' } as const

function preferredTranscriptionId(): string | null {
  try {
    return localStorage.getItem(MODEL_KEY)
  } catch {
    return null
  }
}

export function selectTranscriptionOption(
  language: AppLanguage,
  systemLanguages: readonly AppLanguage[] = [],
  preferred = preferredTranscriptionId(),
): TranscriptionModel | typeof systemTranscriptionOption {
  const model = transcriptionModels.find(({ id, languages }) => id === preferred && languages.includes(language))
  if (model) return model
  return (preferred === null || preferred === systemTranscriptionOption.id) && systemLanguages.includes(language)
    ? systemTranscriptionOption
    : transcriptionModels[0]
}

export function saveTranscriptionModel(id: string): void {
  localStorage.setItem(MODEL_KEY, id)
}

const cache = createStore('kibotalk-models', 'files')
type ByteProgressListener = (bytes: number) => void
const downloads = new Map<string, {
  blob: Promise<Blob>
  progress: { received: number; listeners: Set<ByteProgressListener> }
}>()

function validModel(file: ModelFile, blob: Blob) {
  return blob.size > 0 && (file.bytes === undefined || file.bytes === blob.size)
}

async function cachedFile(file: ModelFile): Promise<Blob | undefined> {
  const blob = await get<Blob>(file.url, cache)
  if (blob && validModel(file, blob)) return blob
}

export async function modelIsDownloaded(model: TranscriptionModel): Promise<boolean> {
  const files = await Promise.all(model.files.map(cachedFile))
  return files.every(Boolean)
}

async function readBundledModel(file: ModelFile): Promise<Blob | undefined> {
  if (!file.bundledName || !globalThis.navigator?.userAgent.includes('Electron/')) return
  try {
    const response = await fetch(`${BUNDLED_MODEL_SCHEME}://app/${file.bundledName}`)
    if (!response.ok) return
    const blob = await response.blob()
    if (validModel(file, blob)) return blob
  } catch {
    // Development and older installations can use the same versioned download cache.
  }
}

async function readModelFile(file: ModelFile, onProgress: ByteProgressListener): Promise<Blob> {
  const existing = await readBundledModel(file) ?? await cachedFile(file)
  if (existing) {
    onProgress(existing.size)
    return existing
  }
  const response = await fetch(file.url)
  if (!response.ok || !response.body) throw new Error(`Model download HTTP ${response.status}`)
  let received = 0
  const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength
      onProgress(received)
      controller.enqueue(chunk)
    },
  }))
  const data = await new Response(stream).blob()
  if (!validModel(file, data)) throw new Error('Model download is incomplete')
  await set(file.url, data, cache)
  return data
}

export async function loadModelFile(file: ModelFile, onProgress?: ByteProgressListener): Promise<Blob> {
  let download = downloads.get(file.url)
  if (!download) {
    const progress = { received: 0, listeners: new Set<ByteProgressListener>() }
    const blob = readModelFile(file, (received) => {
      progress.received = received
      for (const listener of progress.listeners) listener(received)
    }).finally(() => downloads.delete(file.url))
    download = { blob, progress }
    downloads.set(file.url, download)
  }
  if (!onProgress) return download.blob

  const { progress } = download
  progress.listeners.add(onProgress)
  try {
    onProgress(progress.received)
    return await download.blob
  } finally {
    progress.listeners.delete(onProgress)
  }
}

export async function prepareBaseSpeechModels(onProgress?: (fraction: number) => void): Promise<void> {
  const total = baseSpeechModelFiles.reduce((sum, file) => sum + file.bytes, 0)
  const receivedByFile = baseSpeechModelFiles.map(() => 0)
  const files = baseSpeechModelFiles.map((file, index) =>
    loadModelFile(file, (bytes) => {
      receivedByFile[index] = bytes
      const received = receivedByFile.reduce((sum, size) => sum + size, 0)
      onProgress?.(Math.min(0.99, received / total))
    }))
  await Promise.all(files)
  onProgress?.(1)
}

export async function downloadTranscriptionModel(
  model: TranscriptionModel,
  onProgress?: (fraction: number) => void,
): Promise<{ data: Blob; metadata: string }> {
  const [dataFile, metadataFile] = model.files
  const [data, metadata] = await Promise.all([
    loadModelFile(dataFile, (bytes) => onProgress?.(Math.min(0.99, bytes / dataFile.bytes))),
    loadModelFile(metadataFile).then((file) => file.text()),
  ])
  onProgress?.(1)
  return { data, metadata }
}
