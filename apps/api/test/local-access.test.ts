import { describe, expect, it } from 'vitest'
import { app } from '../src/app'

describe('local proxy access', () => {
  it.each([
    { url: 'http://evil.example/api/local-token' },
    { url: '/api/local-token', origin: 'https://evil.example' },
    { url: '/api/local-token', origin: 'null' },
  ])('rejects requests outside the local application context ($url, $origin)', async ({ url, origin }) => {
    const response = await app.request(url, { headers: origin ? { Origin: origin } : {} })
    expect(response.status).toBe(403)
  })

  it('allows the packaged desktop renderer to use the loopback proxy with its local token', async () => {
    const tokenResponse = await app.request('/api/local-token')
    expect(tokenResponse.headers.get('cache-control')).toBe('no-store')
    const { token } = await tokenResponse.json() as { token: string }

    const response = await app.request('/api/stt/providers', {
      headers: { Origin: 'null', 'X-KiboTalk-Local-Token': token },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('null')
  })

  it('retains the HTTP payload limit after removing the account routes', async () => {
    const response = await app.request('/api/llm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024 + 1) },
      body: '{}',
    })
    expect(response.status).toBe(413)
  })

  it.each(['/api/auth/me', '/api/sync', '/api/account/quota', '/api/admin/dashboard'])(
    'returns 404 for the retired %s endpoint',
    async (path) => {
      expect((await app.request(path)).status).toBe(404)
    },
  )
})
