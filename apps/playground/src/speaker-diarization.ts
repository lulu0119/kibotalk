import { loadModelFile, speakerModelFile } from '@kibotalk/app-shared'
import { createDiarizer, createSpeakerTracker, type ModelPack } from '@sherpaw/speaker-diarization'

import { createStreamingDiarizer, segmentationUtterances } from '@sherpaw/speaker-diarization/conversation'

const segmentationModel = {
  url: 'https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/9403a6902bb58e3d5ae8c7e77c3422de279db2e0/model.onnx',
  bytes: 5_992_913,
}
const sampleRate = 16_000

function modelPack(filename: string, data: ArrayBuffer): ModelPack {
  return {
    data,
    metadata: {
      files: [{ filename, start: 0, end: data.byteLength }],
      remote_package_size: data.byteLength,
    },
  }
}

export async function analyzeSpeakers(
  file: File,
  speakerCount: number | undefined,
  signal: AbortSignal,
  onStatus: (status: string) => void,
) {
  onStatus('正在读取音轨…')
  let audio: AudioBuffer
  try {
    const decoder = new OfflineAudioContext(1, 1, sampleRate)
    audio = await decoder.decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new Error('无法读取这个文件的音轨。请试试 WAV、MP3 或带 AAC 音轨的 MP4。')
  }
  signal.throwIfAborted()
  onStatus('正在准备声纹模型…')
  const { segmentation, embedding } = await loadSpeakerModels(signal)
  const diarizer = await createDiarizer({
    model: {
      segmentation: modelPack('/speaker-segmentation.onnx', segmentation),
      embedding,
    },
    clustering: speakerCount ? { numSpeakers: speakerCount } : { distanceThreshold: 0.5 },
    signal,
  })
  try {
    onStatus('正在识别说话人…')
    const samples = new Float32Array(audio.length)
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const pcm = audio.getChannelData(channel)
      for (let i = 0; i < samples.length; i++) samples[i] += pcm[i] / audio.numberOfChannels
    }
    const segments = await diarizer.diarize(samples, audio.sampleRate)
    return { duration: audio.duration, segments }
  } finally {
    diarizer.dispose()
  }
}

async function loadSpeakerModels(signal: AbortSignal) {
  const [segmentation, embedding] = await Promise.all([
    loadModelFile(segmentationModel).then((blob) => blob.arrayBuffer()),
    loadModelFile(speakerModelFile).then((blob) => blob.arrayBuffer()),
  ])
  signal.throwIfAborted()
  return { segmentation, embedding: modelPack('/speaker-embedding.onnx', embedding) }
}

export async function createLiveSpeakerDiarizer(signal: AbortSignal) {
  const { segmentation, embedding } = await loadSpeakerModels(signal)
  const tracker = await createSpeakerTracker({
    model: embedding,
    segmentation: { data: segmentation },
    // Keep distinct voices in separate clusters and leave new voices provisional.
    tuning: { clusterThreshold: 0.5, nearestThreshold: 0.5, borrowThreshold: 1 },
    signal,
  })
  return createStreamingDiarizer({
    tracker,
    speech: segmentationUtterances(tracker, { minSilenceSeconds: 0.3 }),
    signal,
  })
}
