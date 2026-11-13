import { IndexedDbEmbeddingStorage } from '@kibotalk/speaker'
import { speakerModelId, speakerModelRevision } from './audio/local-models'

const LEGACY_SPEAKER_EMBEDDING_DATABASES = [
  'kibotalk-speaker',
  'kibotalk-speaker:onnx-community--wespeaker-voxceleb-resnet34-LM:6a61a1833ff2583aabeba044f5c8221f00b67ceb:q8',
]

export const CURRENT_SPEAKER_EMBEDDING_DATABASE = [
  'kibotalk-speaker',
  speakerModelId,
  speakerModelRevision,
].join(':')

export function createCurrentSpeakerEmbeddingStorage(scope?: string): IndexedDbEmbeddingStorage {
  const database = scope ? `${CURRENT_SPEAKER_EMBEDDING_DATABASE}:${scope}` : CURRENT_SPEAKER_EMBEDDING_DATABASE
  return new IndexedDbEmbeddingStorage(database)
}

/**
 * User-initiated voiceprint deletion/reset clears both the current model's
 * namespace and known legacy namespaces. Model migration stays out of the
 * generic speaker core and never attempts to reinterpret incompatible vectors.
 */
export async function clearSpeakerEmbeddingData(): Promise<void> {
  await Promise.all([
    createCurrentSpeakerEmbeddingStorage().clear(),
    ...LEGACY_SPEAKER_EMBEDDING_DATABASES.map((database) =>
      new IndexedDbEmbeddingStorage(database).clear(),
    ),
  ])
}
