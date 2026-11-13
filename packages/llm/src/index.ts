import { chat, messages, responses, streamText } from 'xsai'

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

export async function* streamReplyText(
  settings: LlmSettings,
  input: ChatMessage[],
  signal: AbortSignal,
  fetcher?: typeof fetch,
): AsyncGenerator<string> {
  if (!settings.baseURL || !settings.model) throw new Error('LLM_SETTINGS_REQUIRED')
  const url = new URL(settings.baseURL)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('LLM_INVALID_URL')
  }
  const model = textModels[settings.protocol]({
    baseURL: url.href,
    apiKey: settings.apiKey || undefined,
    model: settings.model,
    path: settings.path,
    fetch: fetcher,
  })
  const stream = streamText(model, {
    input,
    signal,
    ...(settings.providerId === 'deepseek' && settings.protocol === 'chat'
      ? { extraBody: { thinking: { type: 'disabled' } } }
      : {}),
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
