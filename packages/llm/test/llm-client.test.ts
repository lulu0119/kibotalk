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
      expect(await request.json()).toMatchObject({ model: 'local-model', stream: true, messages: input })
      return reply('one', ' two')
    })
    await expect(read(settings, fetcher)).resolves.toEqual(['one', ' two'])
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
