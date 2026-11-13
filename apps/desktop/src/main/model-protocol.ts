import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, net, protocol } from 'electron'
import { baseSpeechModelFiles, BUNDLED_MODEL_SCHEME } from '@kibotalk/app-shared/local-models'

export function registerModelProtocolScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: BUNDLED_MODEL_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  }])
}

export function registerModelProtocolHandler() {
  const directory = app.isPackaged ? join(process.resourcesPath, 'models') : join(app.getAppPath(), 'resources/bundle-models')
  const allowed = new Set<string>(baseSpeechModelFiles.map((file) => file.bundledName))
  protocol.handle(BUNDLED_MODEL_SCHEME, async (request) => {
    const url = new URL(request.url)
    const name = url.pathname.slice(1)
    if (request.method !== 'GET' || url.host !== 'app' || !allowed.has(name)) {
      return new Response(null, { status: 404 })
    }
    const path = join(directory, name)
    if (!existsSync(path)) return new Response(null, { status: 404 })
    const response = await net.fetch(pathToFileURL(path).href)
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/octet-stream',
      },
    })
  })
}
