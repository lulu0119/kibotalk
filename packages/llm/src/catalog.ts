import type { Model, Provider } from '@xsai-ext/providers'
import { fetchProviders } from '@xsai-ext/providers/fetch'
import type { TextProtocol } from './index'

export { route, type Provider } from '@xsai-ext/providers'

const textProtocols: TextProtocol[] = ['chat', 'responses', 'messages']

export function isTextProtocol(value: string): value is TextProtocol {
  return textProtocols.some((protocol) => protocol === value)
}

export function availableTextProtocols(provider: Provider, model: Model): TextProtocol[] {
  const preferences = new Set([...(provider.protocols ?? []), ...textProtocols])
  return [...preferences].filter(isTextProtocol).filter((protocol) => {
    const candidate = model.routes[protocol]
    return candidate && !candidate.variables?.length
  })
}

let catalogRequest: Promise<Provider[]> | undefined

export function loadCatalog() {
  return catalogRequest ??= fetchProviders({
    url: 'https://models.dev/experimental/v2.0/api.json?type=chat',
    signal: AbortSignal.timeout(12000),
  }).then((result) => {
    if (result.notModified) return []
    return Object.values(result.providers)
      .filter((provider) => Object.values(provider.models).some((model) => availableTextProtocols(provider, model).length))
      .sort((left, right) => left.name.localeCompare(right.name))
  }).catch((cause) => {
    catalogRequest = undefined
    throw cause
  })
}
