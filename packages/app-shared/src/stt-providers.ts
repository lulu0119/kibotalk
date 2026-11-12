import { apiFetch } from './api-runtime'

export type SttProvider = {
  id: string
  label: string
  model: string
  active: boolean
  mode: 'realtime'
}

export function defaultSttProvider(providers: SttProvider[]): string | null {
  return providers.find((p) => p.active)?.id ?? providers[0]?.id ?? null
}

/** Fetch realtime STT providers configured server-side. */
export async function fetchSttProviders(): Promise<SttProvider[]> {
  const res = await apiFetch('/api/stt/providers', { signal: AbortSignal.timeout(4000) }).catch(() => null)
  if (!res?.ok) return []
  const data = (await res.json().catch(() => ({}))) as { providers?: SttProvider[] }
  return data.providers ?? []
}
