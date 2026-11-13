import type { Embedding, EmbeddingStorage } from '@kibotalk/speaker'
import { clear, createStore, get, set } from 'idb-keyval'
import { speakerModelId, speakerModelRevision } from './audio/local-models'

const STORE_NAME = 'embedding'
const EMBEDDING_KEY = 'enrolled'

const LEGACY_SPEAKER_EMBEDDING_DATABASES = [
  'kibotalk-speaker',
  'kibotalk-speaker:onnx-community--wespeaker-voxceleb-resnet34-LM:6a61a1833ff2583aabeba044f5c8221f00b67ceb:q8',
]

export const CURRENT_SPEAKER_EMBEDDING_DATABASE = [
  'kibotalk-speaker',
  speakerModelId,
  speakerModelRevision,
].join(':')

export function createCurrentSpeakerEmbeddingStorage(scope?: string): EmbeddingStorage {
  const database = scope ? `${CURRENT_SPEAKER_EMBEDDING_DATABASE}:${scope}` : CURRENT_SPEAKER_EMBEDDING_DATABASE
  const store = createStore(database, STORE_NAME)

  return {
    async load() {
      const saved = await get<Omit<Embedding, 'vector'> & { vector: number[] }>(EMBEDDING_KEY, store)
      return saved ? { ...saved, vector: new Float32Array(saved.vector) } : null
    },
    save(embedding) {
      return set(EMBEDDING_KEY, { ...embedding, vector: Array.from(embedding.vector) }, store)
    },
    clear() {
      return clear(store)
    },
  }
}

/**
 * User-initiated voiceprint deletion/reset clears both the current model's
 * namespace and known legacy namespaces.
 */
export async function clearSpeakerEmbeddingData(): Promise<void> {
  await Promise.all([
    createCurrentSpeakerEmbeddingStorage().clear(),
    ...LEGACY_SPEAKER_EMBEDDING_DATABASES.map((database) => clear(createStore(database, STORE_NAME))),
  ])
}
