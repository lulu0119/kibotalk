const LOCAL_API_ORIGIN = 'http://127.0.0.1:8787'

type DesktopApp = {
  getLocalApiToken: () => Promise<string>
  previousHistoryUserId: string | null
}

export function desktopApp(): DesktopApp | undefined {
  return (globalThis as typeof globalThis & { kibotalk?: { app: DesktopApp } }).kibotalk?.app
}

function usesSameOrigin(): boolean {
  return typeof location !== 'undefined'
    && (location.protocol === 'http:' || location.protocol === 'https:')
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (usesSameOrigin()) return fetch(path, init)
  const headers = new Headers(init.headers)
  const token = await desktopApp()?.getLocalApiToken()
  if (token) headers.set('x-kibotalk-local-token', token)
  return fetch(`${LOCAL_API_ORIGIN}${path}`, { ...init, headers })
}

export async function websocketApiUrl(path: string, params: URLSearchParams): Promise<string> {
  const sameOrigin = usesSameOrigin()
  const desktop = sameOrigin ? undefined : desktopApp()
  let token: string | undefined
  if (desktop) {
    token = await desktop.getLocalApiToken()
  } else {
    const response = await apiFetch('/api/local-token')
    if (response.ok) {
      const body = await response.json() as { token?: string }
      token = body.token
    }
  }
  if (!token) throw new Error('Local KiboTalk proxy is unavailable')

  const url = new URL(path, sameOrigin ? location.origin : LOCAL_API_ORIGIN)
  params.set('token', token)
  url.search = params.toString()
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
