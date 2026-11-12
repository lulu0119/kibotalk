import { createHmac, randomUUID } from 'node:crypto'
import type { Context } from 'hono'
const DEFAULT_WS_URL =
  'wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1'
const SAMPLE_RATE = 16_000

type IflytekConfig = {
  appId: string
  apiKey: string
  apiSecret: string
  wsUrl: string
}

function configFromEnv(env: NodeJS.ProcessEnv = process.env): IflytekConfig {
  const appId = env.STT_IFLYTEK_APP_ID
  const apiKey = env.STT_IFLYTEK_API_KEY
  const apiSecret = env.STT_IFLYTEK_API_SECRET
  if (!appId || !apiKey || !apiSecret) {
    throw new Error(
      'Missing iFlytek realtime config: need STT_IFLYTEK_APP_ID, STT_IFLYTEK_API_KEY and STT_IFLYTEK_API_SECRET',
    )
  }
  return {
    appId,
    apiKey,
    apiSecret,
    wsUrl: env.STT_IFLYTEK_WS_URL ?? DEFAULT_WS_URL,
  }
}

function utcAtChinaStandardTime(now: Date): string {
  const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1_000)
  return `${chinaTime.toISOString().slice(0, 19)}+0800`
}

function encodedParameters(parameters: Record<string, string>): string {
  return Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

function languageParameters(language: string | undefined): Record<string, string> {
  if (language === 'ja') {
    return {
      lang: 'autominor',
      recognized_language: 'ja',
    }
  }
  return { lang: 'autodialect' }
}

export function createIflytekSignedUrl(args: {
  config: IflytekConfig
  language?: string
  now?: Date
  uuid?: string
}): string {
  const parameters = {
    accessKeyId: args.config.apiKey,
    appId: args.config.appId,
    uuid: args.uuid ?? randomUUID().replaceAll('-', ''),
    utc: utcAtChinaStandardTime(args.now ?? new Date()),
    audio_encode: 'pcm_s16le',
    samplerate: String(SAMPLE_RATE),
    ...languageParameters(args.language),
  }
  const signature = createHmac('sha1', args.config.apiSecret)
    .update(encodedParameters(parameters))
    .digest('base64')
  const url = new URL(args.config.wsUrl)
  for (const [key, value] of Object.entries({ ...parameters, signature })) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export function issueIflytekDirectSession(context: Context): Response {
  const language = context.req.query('language')
  try {
    const url = createIflytekSignedUrl({ config: configFromEnv(), language })
    return context.json({ url })
  } catch (cause) {
    return context.json({
      error: 'STT_NOT_CONFIGURED',
      message: cause instanceof Error ? cause.message : String(cause),
    }, 503)
  }
}
