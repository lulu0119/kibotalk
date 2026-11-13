import { expose } from 'comlink'
import { loadVirtualData } from '@sherpaw/preloader'
import { createExtractor, initSpeakerIdentificationModule } from '@sherpaw/speaker-identification'
import { loadModelFile, speakerModelFile } from './local-models'

let extractor: Promise<ReturnType<typeof createExtractor>> | undefined

async function loadExtractor() {
  const [module, model] = await Promise.all([
    initSpeakerIdentificationModule(),
    loadModelFile(speakerModelFile),
  ])
  loadVirtualData({ module, virtualData: { 'speaker.onnx': await model.arrayBuffer() } })
  return createExtractor(module, { model: '/speaker.onnx' })
}

const api = {
  async embed(pcm: Float32Array): Promise<Float32Array> {
    extractor ??= loadExtractor().catch((cause) => {
      extractor = undefined
      throw cause
    })
    // AudioWorklet resampling can overshoot the PCM range accepted by Sherpaw.
    pcm.forEach((sample, index) => {
      pcm[index] = Math.max(-1, Math.min(1, sample))
    })
    return (await extractor).extract(pcm, 16000)
  },
}

expose(api)
export type SpeakerWorker = typeof api
