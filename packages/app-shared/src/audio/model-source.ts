import { env } from '@huggingface/transformers'

export {
  SPEAKER_MODEL_DTYPE,
  SPEAKER_MODEL_ID,
  SPEAKER_MODEL_REVISION,
} from './speaker-model-contract'

/**
 * Scheme `apps/desktop` registers in its main process (see
 * `apps/desktop/src/main/model-protocol.ts`) to serve model files that were
 * downloaded ahead of time by `apps/desktop/scripts/download-models.ts` and
 * bundled into the installer via `extraResources`.
 */
export const BUNDLED_MODELS_HOST = 'kibotalk-model://app/'

/**
 * Points this JS realm's transformers.js instance at desktop's bundled model
 * files instead of the real Hugging Face Hub, so `from_pretrained` never
 * touches the network. Every realm that loads a model directly has its own
 * `env` (Silero VAD runs on the main thread; the speaker-embedding model
 * runs in a Web Worker — see `configureModelSource` for the worker side), so
 * each must call this itself. `apps/web` instead calls
 * `useHuggingFaceModels` and caches the revision-pinned Q8 files from the
 * public Hugging Face Hub. Speaker verification uses the revision-pinned Q8
 * WeSpeaker model selected by the held-out target/non-target benchmark.
 */
export function useBundledModels(): void {
  env.allowRemoteModels = true
  env.remoteHost = BUNDLED_MODELS_HOST
  env.remotePathTemplate = '{model}/'
  env.useBrowserCache = false
}

/** Uses revision-pinned assets from Hugging Face with the browser cache. */
export function useHuggingFaceModels(): void {
  env.allowLocalModels = false
  env.allowRemoteModels = true
  env.remoteHost = 'https://huggingface.co/'
  env.remotePathTemplate = '{model}/resolve/{revision}/'
  env.useBrowserCache = true
}
