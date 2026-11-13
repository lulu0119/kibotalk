import { createBrowserReplyModel, createCurrentSpeakerEmbeddingStorage } from '@kibotalk/app-shared'

export const playgroundReplyModel = createBrowserReplyModel('kibotalk.playground.replyModel')
export const playgroundVoiceprint = createCurrentSpeakerEmbeddingStorage('playground')
