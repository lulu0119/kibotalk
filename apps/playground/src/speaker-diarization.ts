import { loadModelFile, speakerModelFile } from '@kibotalk/app-shared'
import type { Embedding } from '@kibotalk/speaker'
import { createDiarizer, createSpeakerTracker, type ModelPack } from '@sherpaw/speaker-diarization'

import { createStreamingDiarizer, segmentationUtterances } from '@sherpaw/speaker-diarization/conversation'
import { decodeMonoAudio } from './audio-file'

const segmentationModel = {
  url: 'https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/9403a6902bb58e3d5ae8c7e77c3422de279db2e0/model.onnx',
  bytes: 5_992_913,
}
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
  const audio = await decodeMonoAudio(file)
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
    const segments = await diarizer.diarize(audio.samples, audio.sampleRate)
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

export async function createLiveSpeakerDiarizer(signal: AbortSignal, voiceprint?: Embedding, enrollThreshold?: number) {
  const { segmentation, embedding } = await loadSpeakerModels(signal)
  const tracker = await createSpeakerTracker({
    model: embedding,
    segmentation: { data: segmentation },
    // Keep distinct voices in separate clusters and leave new voices provisional.
    tuning: {
      clusterThreshold: 0.5, nearestThreshold: 0.5, borrowThreshold: 1,
      ...(enrollThreshold === undefined ? {} : { enrollThreshold }),
    },
    signal,
  })
  // The stored vector is a fixed anchor. Only enrollment merging uses the duration.
  const owner = voiceprint ? await tracker.enrollVoiceprint({ embedding: voiceprint.vector, seconds: 2.5 }) : undefined
  const diarizer = createStreamingDiarizer({
    tracker,
    speech: segmentationUtterances(tracker, { minSilenceSeconds: 0.3 }),
    signal,
  })
  return { diarizer, owner }
}
