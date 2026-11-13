import { expose } from 'comlink'
import { createStreamingRecognizer, initASRModule, OnlineRecognizerTypes, type StreamingRecognizer } from '@sherpaw/asr'
import { loadData, loadVirtualData, type DataMetadata } from '@sherpaw/preloader'
import { createVad, initVADModule, type VadInstance } from '@sherpaw/vad'
import type { TranscriptionModel } from './local-models'

const SAMPLE_RATE = 16000
const WINDOW_SIZE = 512
const SPEAKER_PREVIEW_SAMPLES = SAMPLE_RATE * 1.5

export type SpeechOptions = {
  threshold: number
  minSpeechMs: number
  minSilenceMs: number
  maxSpeechMs: number
  previewSpeaker?: boolean
}

export type SpeechSegment = {
  pcm: Float32Array
  text: string
  startedAt: number
  endedAt: number
}

export type SpeechUpdate = {
  speaking: boolean
  draft?: { startedAt: number; text: string }
  segments: SpeechSegment[]
  speakerPreview?: Float32Array
}

type Lane = {
  vad: VadInstance
  stream?: StreamingRecognizer
  pending: Promise<unknown>
  firstFrameAt?: number
  sampleCount: number
  draftStartedAt?: number
  leading: Float32Array[]
  leadingFrames: number
  speakerPreview?: { pcm: Float32Array; length: number }
}

let createRecognizer: (() => Promise<StreamingRecognizer>) | undefined
let previewSpeaker = false
const lanes: Lane[] = []

function enqueue<T>(index: number, operation: (lane: Lane) => Promise<T>): Promise<T> {
  const lane = lanes[index]
  const result = lane.pending.then(() => operation(lane))
  lane.pending = result.catch(() => {})
  return result
}

async function drain(lane: Lane): Promise<SpeechSegment[]> {
  const segments: SpeechSegment[] = []
  while (!lane.vad.isEmpty()) {
    const { samples, start } = lane.vad.front()
    lane.vad.pop()
    const stream = lane.stream ?? await createRecognizer?.()
    let text = ''
    if (stream) {
      try {
        if (lane.draftStartedAt === undefined) await stream.accept(samples)
        text = (await stream.finish()).trim()
      } finally {
        lane.stream = undefined
        lane.draftStartedAt = undefined
        await stream.dispose()
      }
    }
    lane.leading = []
    const startedAt = lane.firstFrameAt! + start * 1000 / SAMPLE_RATE
    segments.push({ pcm: samples, text, startedAt, endedAt: startedAt + samples.length * 1000 / SAMPLE_RATE })
  }
  return segments
}

function collectSpeakerPreview(lane: Lane, pcm: Float32Array, speaking: boolean) {
  if (!speaking) {
    lane.speakerPreview = undefined
    return
  }
  const preview = lane.speakerPreview ??= { pcm: new Float32Array(SPEAKER_PREVIEW_SAMPLES), length: 0 }
  if (preview.length === preview.pcm.length) return
  const length = Math.min(pcm.length, preview.pcm.length - preview.length)
  preview.pcm.set(pcm.subarray(0, length), preview.length)
  preview.length += length
  if (preview.length === preview.pcm.length) return preview.pcm
}

const worker = {
  async initialize(
    transcription: {
      model: Pick<TranscriptionModel, 'recognizer' | 'modelingUnit'>
      pack: { data: Blob; metadata: string }
    } | undefined,
    vadFile: Blob,
    options: SpeechOptions,
    laneCount: number,
  ) {
    previewSpeaker = options.previewSpeaker ?? false
    const [vadModule, vadData] = await Promise.all([initVADModule(), vadFile.arrayBuffer()])
    if (transcription) {
      const { model, pack } = transcription
      const module = await initASRModule()
      loadData({ module, metadata: JSON.parse(pack.metadata) as DataMetadata, data: await pack.data.arrayBuffer() })
      const type = model.recognizer === 'paraformer' ? OnlineRecognizerTypes.Paraformer : OnlineRecognizerTypes.Transducer
      createRecognizer = () => createStreamingRecognizer(module, {
        type,
        enableEndpoint: 0,
        modelConfig: { modelingUnit: model.modelingUnit },
      })
    }
    loadVirtualData({ module: vadModule, virtualData: { 'silero.onnx': vadData } })
    for (let index = 0; index < laneCount; index++) {
      lanes.push({
        vad: createVad(vadModule, {
          sampleRate: SAMPLE_RATE,
          numThreads: 1,
          provider: 'cpu',
          bufferSizeInSeconds: Math.ceil(options.maxSpeechMs / 1000) + 2,
          sileroVad: {
            model: '/silero.onnx',
            windowSize: WINDOW_SIZE,
            threshold: options.threshold,
            minSpeechDuration: options.minSpeechMs / 1000,
            minSilenceDuration: options.minSilenceMs / 1000,
            maxSpeechDuration: options.maxSpeechMs / 1000,
          },
        }),
        sampleCount: 0,
        leading: [],
        pending: Promise.resolve(),
        stream: await createRecognizer?.(),
        // Match Sherpa's lookback when it declares the start of a speech segment.
        leadingFrames: Math.ceil(options.minSpeechMs * SAMPLE_RATE / 1000 / WINDOW_SIZE) + 2,
      })
    }
  },
  process(index: number, pcm: Float32Array, capturedAt: number): Promise<SpeechUpdate> {
    return enqueue(index, async (lane) => {
      lane.firstFrameAt ??= capturedAt - pcm.length * 1000 / SAMPLE_RATE
      lane.sampleCount += pcm.length
      lane.vad.acceptWaveform(pcm)
      let text = ''
      // Warm the next recognizer on the frame after publishing the final result.
      const stream = lane.stream ??= await createRecognizer?.()
      if (stream && lane.draftStartedAt !== undefined) {
        text = await stream.accept(pcm)
      } else if (stream) {
        lane.leading.push(pcm)
        if (lane.leading.length > lane.leadingFrames) lane.leading.shift()
        if (lane.vad.isDetected()) {
          lane.draftStartedAt = lane.firstFrameAt + (lane.sampleCount - pcm.length) * 1000 / SAMPLE_RATE
          for (const frame of lane.leading) text = await stream.accept(frame)
          lane.leading = []
        }
      }
      const segments = await drain(lane)
      const speaking = lane.vad.isDetected()
      const speakerPreview = previewSpeaker && collectSpeakerPreview(lane, pcm, speaking && segments.length === 0)
      return {
        speaking,
        draft: lane.draftStartedAt === undefined ? undefined : { text: text.trim(), startedAt: lane.draftStartedAt },
        segments,
        ...(speakerPreview && { speakerPreview }),
      }
    })
  },
  finish(index: number): Promise<SpeechSegment[]> {
    return enqueue(index, (lane) => {
      lane.vad.flush()
      return drain(lane)
    })
  },
  reset(index: number): Promise<void> {
    return enqueue(index, async (lane) => {
      if (lane.draftStartedAt !== undefined) {
        await lane.stream?.dispose()
        lane.stream = undefined
        lane.draftStartedAt = undefined
      }
      lane.vad.reset()
      lane.firstFrameAt = undefined
      lane.sampleCount = 0
      lane.leading = []
      lane.speakerPreview = undefined
    })
  },
}

expose(worker)
export type SpeechWorker = typeof worker
