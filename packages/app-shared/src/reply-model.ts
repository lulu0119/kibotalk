import type { LlmClient } from '@kibotalk/pipeline'
import type { AppLanguage, LearnerLevel } from '@kibotalk/conversation'
import {
  emptyLlmSettings,
  readLlmSettings,
  streamReplyText,
  testReplyModel,
  type ReplyModelHost,
  type ReplyTextStream,
} from '@kibotalk/llm'
import { buildReplySuggestionsMessages } from '@kibotalk/prompts'
import { extractCandidates } from './partial-json'

export type SessionLanguageSnapshot = {
  conversationLang: AppLanguage
  meaningLang: AppLanguage
  level: LearnerLevel
}

function browserReplyConnection(signal: AbortSignal) {
  let connectionFailed = false
  return {
    fetcher: (async (...args) => {
      try {
        return await fetch(...args)
      } catch (cause) {
        connectionFailed = cause instanceof TypeError
        throw cause
      }
    }) satisfies typeof fetch,
    error(cause: unknown) {
      return connectionFailed && !signal.aborted ? new Error('LLM_BROWSER_CONNECTION', { cause }) : cause
    },
  }
}

export function createBrowserReplyModel(settingsKey: string): ReplyModelHost {
  const settings: ReplyModelHost['settings'] = {
    async load() {
      try {
        return readLlmSettings(JSON.parse(localStorage.getItem(settingsKey) ?? 'null'))
      } catch {
        return emptyLlmSettings
      }
    },
    async save(value) {
      localStorage.setItem(settingsKey, JSON.stringify(readLlmSettings(value)))
    },
  }

  return {
    settings,
    async *stream(input, signal) {
      const config = await settings.load()
      const connection = browserReplyConnection(signal)
      try {
        yield* streamReplyText(config, input, signal, connection.fetcher)
      } catch (cause) {
        throw connection.error(cause)
      }
    },
    async test(config) {
      const signal = AbortSignal.timeout(15000)
      const connection = browserReplyConnection(signal)
      try {
        await testReplyModel(config, signal, connection.fetcher)
      } catch (cause) {
        throw connection.error(cause)
      }
    },
  }
}

export const browserReplyModel = createBrowserReplyModel('kibotalk.replyModel')

export function createReplyClient(
  snapshot: SessionLanguageSnapshot,
  isEnabled: () => boolean,
  stream: ReplyTextStream,
  onError: (message: string) => void,
): LlmClient {
  return {
    async *streamCandidates(context, signal) {
      if (!isEnabled()) {
        yield { type: 'done' }
        return
      }

      let raw = ''
      let emitted = 0
      try {
        const input = await buildReplySuggestionsMessages({ context, ...snapshot })
        for await (const text of stream(input, signal)) {
          if (!isEnabled()) break
          if (!raw && text) yield { type: 'first-token' }
          raw += text
          const complete = extractCandidates(raw)
          for (; emitted < complete.length; emitted++) {
            const candidate = complete[emitted]
            yield { type: 'candidate-start', index: emitted }
            yield { type: 'candidate-delta', index: emitted, field: 'meaning', delta: candidate.meaning }
            yield { type: 'candidate-delta', index: emitted, field: 'targetText', delta: candidate.targetText }
            if (candidate.reading) {
              yield { type: 'candidate-delta', index: emitted, field: 'reading', delta: candidate.reading }
            }
            yield { type: 'candidate-done', index: emitted, candidate }
          }
        }
      } catch (cause) {
        if (!signal.aborted) onError(cause instanceof Error ? cause.message : String(cause))
        throw cause
      }
      yield { type: 'done' }
    },
  }
}
