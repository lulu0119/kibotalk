import { expose } from 'comlink'
import { createOnlineRecognizer, initASRModule, OnlineRecognizerTypes, type OnlineStream } from '@sherpaw/asr'
import { loadData, loadVirtualData, type DataMetadata } from '@sherpaw/preloader'
import { createVad, initVADModule, type VadInstance } from '@sherpaw/vad'
import type { TranscriptionModel } from './local-models'

const SAMPLE_RATE = 16000
const WINDOW_SIZE = 512
// Zipformer emits a final chunk only when the encoder has enough right context.
const TRAILING_CONTEXT = new Float32Array(SAMPLE_RATE * 0.6)

export type SpeechOptions = {
  threshold: number
  minSpeechMs: number
  minSilenceMs: number
  maxSpeechMs: number
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
}

type Lane = {
  vad: VadInstance
  stream?: OnlineStream
  firstFrameAt?: number
  sampleCount: number
  draftStartedAt: number
  leading: Float32Array[]
  leadingFrames: number
}

let recognizer: ReturnType<typeof createOnlineRecognizer> | undefined
const lanes: Lane[] = []

function decode(stream: OnlineStream, pcm: Float32Array): string {
  if (!recognizer) return ''
  stream.acceptWaveform(SAMPLE_RATE, pcm)
  while (recognizer.isReady(stream)) recognizer.decode(stream)
  return (recognizer.getResult(stream).text as string).trim()
}

function finishSegment(lane: Lane, segment: { samples: Float32Array; start: number }): SpeechSegment {
  let text = ''
  if (recognizer) {
    const stream = lane.stream ?? recognizer.createStream()
    try {
      if (!lane.stream) decode(stream, segment.samples)
      stream.acceptWaveform(SAMPLE_RATE, TRAILING_CONTEXT)
      stream.inputFinished()
      while (recognizer.isReady(stream)) recognizer.decode(stream)
      text = (recognizer.getResult(stream).text as string).trim()
    } finally {
      stream.free()
    }
  }
  lane.stream = undefined
  lane.leading = []
  return {
    pcm: segment.samples,
    text,
    startedAt: lane.firstFrameAt! + segment.start * 1000 / SAMPLE_RATE,
    endedAt: lane.firstFrameAt! + (segment.start + segment.samples.length) * 1000 / SAMPLE_RATE,
  }
}

function drain(lane: Lane): SpeechSegment[] {
  const segments: SpeechSegment[] = []
  while (!lane.vad.isEmpty()) {
    segments.push(finishSegment(lane, lane.vad.front()))
    lane.vad.pop()
  }
  return segments
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
    const [vadModule, vadData] = await Promise.all([initVADModule(), vadFile.arrayBuffer()])
    if (transcription) {
      const { model, pack } = transcription
      const module = await initASRModule()
      loadData({ module, metadata: JSON.parse(pack.metadata) as DataMetadata, data: await pack.data.arrayBuffer() })
      const type = model.recognizer === 'paraformer' ? OnlineRecognizerTypes.Paraformer : OnlineRecognizerTypes.Transducer
      recognizer = createOnlineRecognizer(module, {
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
        draftStartedAt: 0,
        leading: [],
        // Match Sherpa's lookback when it declares the start of a speech segment.
        leadingFrames: Math.ceil(options.minSpeechMs * SAMPLE_RATE / 1000 / WINDOW_SIZE) + 2,
      })
    }
  },
  process(index: number, pcm: Float32Array, capturedAt: number): SpeechUpdate {
    const lane = lanes[index]
    lane.firstFrameAt ??= capturedAt - pcm.length * 1000 / SAMPLE_RATE
    lane.sampleCount += pcm.length
    lane.vad.acceptWaveform(pcm)
    let text = ''
    if (lane.stream) {
      text = decode(lane.stream, pcm)
    } else if (recognizer) {
      lane.leading.push(pcm)
      if (lane.leading.length > lane.leadingFrames) lane.leading.shift()
      if (lane.vad.isDetected()) {
        lane.stream = recognizer.createStream()
        lane.draftStartedAt = lane.firstFrameAt + (lane.sampleCount - pcm.length) * 1000 / SAMPLE_RATE
        for (const frame of lane.leading) text = decode(lane.stream, frame)
        lane.leading = []
      }
    }
    const segments = drain(lane)
    return {
      speaking: lane.vad.isDetected(),
      draft: lane.stream ? { text, startedAt: lane.draftStartedAt } : undefined,
      segments,
    }
  },
  finish(index: number): SpeechSegment[] {
    const lane = lanes[index]
    lane.vad.flush()
    return drain(lane)
  },
  reset(index: number): void {
    const lane = lanes[index]
    lane.vad.reset()
    lane.stream?.free()
    lane.stream = undefined
    lane.firstFrameAt = undefined
    lane.sampleCount = 0
    lane.leading = []
  },
}

expose(worker)
export type SpeechWorker = typeof worker
