import { env } from '@huggingface/transformers'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultAppConfig } from '../src/config'
import {
  useBundledModels,
  SPEAKER_MODEL_DTYPE,
  SPEAKER_MODEL_ID,
  SPEAKER_MODEL_REVISION,
  useHuggingFaceModels,
} from '../src/audio/model-source'

afterEach(() => {
  useHuggingFaceModels()
})

describe('model source', () => {
  it('pins the speaker model and threshold selected by held-out trials', () => {
    expect(SPEAKER_MODEL_ID).toBe(
      'onnx-community/wespeaker-voxceleb-resnet34-LM',
    )
    expect(SPEAKER_MODEL_REVISION).toBe(
      '6a61a1833ff2583aabeba044f5c8221f00b67ceb',
    )
    expect(SPEAKER_MODEL_DTYPE).toBe('q8')
    expect(defaultAppConfig.speakerThreshold).toBe(0.49)
  })

  it('uses immutable Hugging Face paths by default', () => {
    useHuggingFaceModels()

    expect(env.remoteHost).toBe('https://huggingface.co/')
    expect(env.remotePathTemplate).toBe('{model}/resolve/{revision}/')
  })

  it('uses packaged desktop models', () => {
    useBundledModels()
    expect(env.remoteHost).toBe('kibotalk-model://app/')
    expect(env.remotePathTemplate).toBe('{model}/')
    expect(env.useBrowserCache).toBe(false)
  })
})
