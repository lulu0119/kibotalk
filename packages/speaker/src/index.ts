export type { Embedding, SpeakerVerifier, VerifyResult } from './types'
export { EmbeddingSpeakerVerifier } from './embedding-verifier'
export type { EmbedAudio, EmbeddingVerifierOptions } from './embedding-verifier'
export { cosineSimilarity } from './cosine-sim'
export { classifySpeaker, stabilizeSpeaker } from './hysteresis'
export {
  EnrollmentAudioError,
  prepareEnrollmentAudio,
  trimSpeakerAudio,
} from './audio-quality'
export type { EnrollmentAudioErrorCode } from './audio-quality'
export type { EmbeddingStorage } from './storage'
export { InMemoryEmbeddingStorage } from './storage'
