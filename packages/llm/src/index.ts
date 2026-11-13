import type { Provider } from '@xsai-ext/providers'
import { anthropic } from '@xsai-ext/providers/models/anthropic'
import { deepseek } from '@xsai-ext/providers/models/deepseek'
import { google } from '@xsai-ext/providers/models/google'
import { openai } from '@xsai-ext/providers/models/openai'
import { openrouter } from '@xsai-ext/providers/models/openrouter'
import { chat, messages, responses, streamText, type HttpOptions, type StreamTextOptions } from 'xsai'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type TextProtocol = 'chat' | 'responses' | 'messages'

export type LlmSettings = {
  providerId: string
  baseURL: string
  apiKey: string
  model: string
  protocol: TextProtocol
  path?: string
}

export const emptyLlmSettings: LlmSettings = {
  providerId: '',
  baseURL: '',
  apiKey: '',
  model: '',
  protocol: 'chat',
}

export type LlmSettingsStore = {
  load: () => Promise<LlmSettings>
  save: (settings: LlmSettings) => Promise<void>
}

export type ReplyTextStream = (input: ChatMessage[], signal: AbortSignal) => AsyncIterable<string>

export type ReplyModelHost = {
  settings: LlmSettingsStore
  stream: ReplyTextStream
  test: (settings: LlmSettings) => Promise<void>
}

export type ReplyStreamMessage =
  | { type: 'token'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

export function readLlmSettings(value: unknown): LlmSettings {
  if (!value || typeof value !== 'object') return emptyLlmSettings
  const settings = value as Partial<LlmSettings>
  return {
    providerId: typeof settings.providerId === 'string' ? settings.providerId : '',
    baseURL: typeof settings.baseURL === 'string' ? settings.baseURL.trim() : '',
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey.trim() : '',
    model: typeof settings.model === 'string' ? settings.model.trim() : '',
    protocol: settings.protocol === 'responses' || settings.protocol === 'messages' ? settings.protocol : 'chat',
    path: typeof settings.path === 'string' ? settings.path : undefined,
  }
}

const textModels = { chat, messages, responses }
const providersByHost = new Map<string, Provider>([
  ['api.anthropic.com', anthropic],
  ['api.deepseek.com', deepseek],
  ['api.openai.com', openai],
  ['generativelanguage.googleapis.com', google],
  ['openrouter.ai', openrouter],
  ['eu.openrouter.ai', openrouter],
])
const disabledThinking = { extraBody: { thinking: { type: 'disabled' } } }
const noReasoning = { reasoningEffort: 'none' } as const

function replyReasoningOptions(
  { model, protocol }: LlmSettings,
  provider: Provider | undefined,
): Pick<HttpOptions, 'extraBody'> & Pick<StreamTextOptions, 'reasoningEffort'> {
  const reasoning = provider?.models[model]?.capabilities?.reasoning
  const supportsNone = reasoning?.efforts?.includes('none')
  if (supportsNone && protocol !== 'messages') return noReasoning

  switch (provider?.id) {
    case 'openrouter':
      if (!supportsNone && !reasoning?.toggle) break
      if (protocol === 'messages') return disabledThinking
      return { extraBody: { reasoning: { enabled: false } } }
    case 'deepseek':
      return protocol === 'messages' ? disabledThinking : noReasoning
    case 'google':
      // Google's OpenAI-compatible API accepts none on the 2.5 models with a toggle.
      if (protocol === 'chat' && model.startsWith('gemini-2.5-') && reasoning?.toggle) return noReasoning
      break
    case 'anthropic':
      // The pinned catalog omits the toggle for Opus 5.
      if (protocol === 'messages' && (reasoning?.toggle || model === 'claude-opus-5')) return disabledThinking
      break
  }
  return {}
}

export async function* streamReplyText(
  settings: LlmSettings,
  input: ChatMessage[],
  signal: AbortSignal,
  fetcher?: typeof fetch,
  maxOutputTokens?: number,
): AsyncGenerator<string> {
  if (!settings.baseURL || !settings.model) throw new Error('LLM_SETTINGS_REQUIRED')
  const url = new URL(settings.baseURL)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('LLM_INVALID_URL')
  }
  const provider = providersByHost.get(url.hostname)
  const { extraBody, reasoningEffort } = replyReasoningOptions(settings, provider)
  const apiKey = settings.apiKey || undefined
  const openRouterMessages = provider?.id === 'openrouter' && settings.protocol === 'messages'
  const model = textModels[settings.protocol]({
    baseURL: url.href,
    apiKey: openRouterMessages ? undefined : apiKey,
    headers: openRouterMessages && apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    extraBody,
    model: settings.model,
    path: settings.path,
    fetch: fetcher,
  })
  const stream = streamText(model, {
    input,
    signal,
    maxOutputTokens: maxOutputTokens ?? (settings.protocol === 'messages' ? 4096 : undefined),
    reasoningEffort,
  })
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.type === 'text.delta') yield value.delta
      if (value.type === 'step.end' && value.error) throw value.error
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function testReplyModel(
  settings: LlmSettings,
  signal = AbortSignal.timeout(15000),
  fetcher?: typeof fetch,
): Promise<void> {
  const input: ChatMessage[] = [{ role: 'user', content: 'Reply with OK.' }]
  for await (const text of streamReplyText(readLlmSettings(settings), input, signal, fetcher, 128)) {
    if (text.trim()) return
  }
  throw new Error('LLM_EMPTY_RESPONSE')
}
