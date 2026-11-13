export { AudioSource } from './audio/audio-source'
export type { AudioSourceOptions } from './audio/audio-source'
export { createWorkerEmbedAudio } from './audio/speaker-embed'
export {
  downloadTranscriptionModel,
  modelIsDownloaded,
  prepareBaseSpeechModels,
  saveTranscriptionModel,
  selectTranscriptionModel,
  transcriptionModels,
  loadModelFile,
  speakerModelFile,
} from './audio/local-models'
export type { TranscriptionModel } from './audio/local-models'
export { browserReplyModel, createBrowserReplyModel, createReplyClient } from './reply-model'
export type { SessionLanguageSnapshot } from './reply-model'

export {
  clearSpeakerEmbeddingData,
  createCurrentSpeakerEmbeddingStorage,
  CURRENT_SPEAKER_EMBEDDING_DATABASE,
} from './speaker-embedding-storage'
export { shouldShowSessionError } from './session/session-presentation'

export { createLocalConversationStorage } from './local-conversation-storage'
export { extractCandidates, extractCompleteObjects } from './partial-json'

export {
  defaultAppConfig,
  defaultLanguagePrefs,
  defaultProductPrefs,
  PASSPHRASE_BY_LANG,
  APP_LANGUAGE_OPTIONS,
  isLearnerLevel,
  LEARNER_LEVEL_OPTIONS,
  systemUiLanguage,
} from './config'
export type { AppConfig, ProductTheme } from './config'

export {
  createSessionSnapshot,
  loadLanguagePrefs,
  persistLanguagePrefs,
  subscribeLanguagePrefs,
} from './language-prefs'
export type { LanguagePrefs } from './language-prefs'
export {
  I18nProvider,
  languageLabel,
  levelLabel,
  localizedSessionTitle,
  useI18n,
} from './i18n'
export type { MessageKey } from './i18n'

export { useConversationSession } from './session/use-conversation-session'
export type {
  ProductSessionLifecycle,
  ConversationSessionParams,
  SessionTurn,
  SessionDraft,
  CandidateRound,
} from './session/use-conversation-session'
export { useProductSession } from './session/use-product-session'
export type {
  ProductSessionController,
  ProductSessionParams,
} from './session/use-product-session'
export { createSpeechEngine, type SpeechEngine } from './audio/speech-engine'
