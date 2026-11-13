import { describe, expect, it, vi } from 'vitest'
import { emptyLlmSettings, streamReplyText, type LlmSettings } from '../src/index'

const settings: LlmSettings = {
  ...emptyLlmSettings,
  baseURL: 'http://localhost:11434/v1',
  model: 'local-model',
}

const input = [{ role: 'user' as const, content: 'hello' }]

async function read(settings: LlmSettings, fetcher: typeof fetch) {
  const chunks = []
  for await (const token of streamReplyText(settings, input, new AbortController().signal, fetcher)) {
    chunks.push(token)
  }
  return chunks
}

function reply(...chunks: string[]) {
  const events = [
    ...chunks.map((content) => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })),
    { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
  ].map((event) => `data: ${JSON.stringify(event)}\n\n`)
  return new Response(events.join('') + 'data: [DONE]\n\n', {
    headers: { 'content-type': 'text/event-stream' },
  })
}

describe('streamReplyText', () => {
  it('streams an OpenAI-compatible local endpoint with no API key', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(url, init)
      expect(request.url).toBe('http://localhost:11434/v1/chat/completions')
      expect(request.headers.get('authorization')).toBeNull()
      const body = await request.json()
      expect(body).toMatchObject({ model: 'local-model', stream: true, messages: input })
      expect(body).not.toHaveProperty('thinking')
      expect(body).not.toHaveProperty('reasoning')
      expect(body).not.toHaveProperty('reasoning_effort')
      return reply('one', ' two')
    })
    await expect(read({ ...settings, providerId: 'deepseek' }, fetcher)).resolves.toEqual(['one', ' two'])
  })

  it('uses the saved path and API key', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(url, init)
      expect(request.url).toBe('http://localhost:11434/v1/custom/chat')
      expect(request.headers.get('authorization')).toBe('Bearer test-key')
      return reply('ok')
    })
    await expect(read({ ...settings, path: 'custom/chat', apiKey: 'test-key' }, fetcher)).resolves.toEqual(['ok'])
  })

  it.each<[string, string, LlmSettings['protocol'], Record<string, unknown>]>([
    ['https://openrouter.ai/api/v1', 'deepseek/deepseek-v4.1-flash-1017', 'chat', { reasoning_effort: 'none' }],
    ['https://openrouter.ai/api/v1', 'deepseek/deepseek-v4.1-flash-1017', 'responses', { reasoning: { effort: 'none' } }],
    ['https://openrouter.ai/api/v1', 'deepseek/deepseek-v4.1-flash-1017', 'messages', { thinking: { type: 'disabled' } }],
    ['https://openrouter.ai/api/v1', 'google/gemini-2.5-flash', 'chat', { reasoning: { enabled: false } }],
    ['https://api.deepseek.com', 'deepseek-flash', 'chat', { reasoning_effort: 'none' }],
    ['https://api.deepseek.com', 'deepseek-flash', 'responses', { reasoning: { effort: 'none' } }],
    ['https://api.deepseek.com/anthropic/v1', 'deepseek-flash', 'messages', { thinking: { type: 'disabled' } }],
    ['https://api.openai.com/v1', 'gpt-5.4', 'chat', { reasoning_effort: 'none' }],
    ['https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.5-flash', 'chat', { reasoning_effort: 'none' }],
    ['https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.5-flash-lite', 'chat', { reasoning_effort: 'none' }],
    ['https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.5-pro', 'chat', {}],
    ['https://generativelanguage.googleapis.com/v1beta/openai', 'gemma-4-26b-a4b-it', 'chat', {}],
    ['https://api.anthropic.com/v1', 'claude-sonnet-5', 'messages', { thinking: { type: 'disabled' } }],
    ['https://api.anthropic.com/v1', 'claude-sonnet-5-5', 'messages', {}],
    ['https://api.anthropic.com/v1', 'claude-opus-5', 'messages', { thinking: { type: 'disabled' } }],
    ['https://api.anthropic.com/v1', 'claude-opus-5-5', 'messages', {}],
  ])('uses the declared reasoning controls for %s %s via %s', async (baseURL, model, protocol, expected) => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => (
      new Response('Test response', { status: 400 })
    ))
    await expect(read({ ...settings, baseURL, model, protocol, apiKey: 'test-key' }, fetcher)).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    const request = new Request(url, init)
    const body = await request.json()
    const { thinking, reasoning, reasoning_effort, output_config } = body
    expect({ thinking, reasoning, reasoning_effort, output_config }).toEqual(expected)
    if (protocol === 'messages') {
      expect(body.max_tokens).toBe(4096)
      if (baseURL === 'https://openrouter.ai/api/v1') {
        expect(request.headers.get('authorization')).toBe('Bearer test-key')
      }
    }
  })

  it('omits reasoning controls for models that require reasoning', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = await new Request(url, init).json()
      expect(body).not.toHaveProperty('reasoning')
      expect(body).not.toHaveProperty('reasoning_effort')
      return reply('ok')
    })
    await expect(read({ ...settings, baseURL: 'https://openrouter.ai/api/v1', model: 'openai/gpt-5' }, fetcher))
      .resolves.toEqual(['ok'])
  })

  it('reports HTTP failures to the caller', async () => {
    const fetcher = vi.fn(async () => new Response('Rejected', { status: 401 }))
    await expect(read(settings, fetcher)).rejects.toThrow()
  })

  it('requests configuration before sending a prompt', async () => {
    const fetcher = vi.fn()
    await expect(read(emptyLlmSettings, fetcher)).rejects.toThrow('LLM_SETTINGS_REQUIRED')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
