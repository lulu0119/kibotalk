import { serveStatic } from '@hono/node-server/serve-static'
import type { AppLanguage, ConversationTurn, LearnerLevel } from '@kibotalk/conversation'
import { createLlmClient, llmConfigFromEnv } from '@kibotalk/llm'
import { buildReplySuggestionsMessages } from '@kibotalk/prompts'
import { listSttProviders } from '@kibotalk/stt'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { issueIflytekDirectSession } from './iflytek-direct'
import { isLoopbackHost, isLoopbackOrigin, localApiToken } from './local-access'

export const app = new Hono()

const APP_LANGUAGES = new Set<AppLanguage>(['ja', 'en', 'zh'])
const LEARNER_LEVELS = new Set<LearnerLevel>(['beginner', 'intermediate', 'advanced'])

function parseAppLanguage(value: unknown, fallback: AppLanguage): AppLanguage {
  return APP_LANGUAGES.has(value as AppLanguage) ? value as AppLanguage : fallback
}

function parseLearnerLevel(value: unknown, fallback: LearnerLevel): LearnerLevel {
  return LEARNER_LEVELS.has(value as LearnerLevel) ? value as LearnerLevel : fallback
}

app.use('/api/*', async (context, next) => {
  const origin = context.req.header('origin')
  if (!isLoopbackHost(new URL(context.req.url).host)
    || (origin && origin !== 'null' && !isLoopbackOrigin(origin))) {
    return context.json({ error: 'LOCAL_ORIGIN_REQUIRED' }, 403)
  }
  await next()
})

app.use('/api/*', cors({
  origin: (origin) => origin === 'null' || isLoopbackOrigin(origin) ? origin : null,
  allowHeaders: ['Content-Type', 'X-KiboTalk-Local-Token'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}))

app.use('/api/*', async (context, next) => {
  if (
    context.req.header('origin') === 'null'
    && context.req.header('x-kibotalk-local-token') !== localApiToken
  ) {
    return context.json({ error: 'LOCAL_TOKEN_REQUIRED' }, 403)
  }
  await next()
})

app.use('/api/*', bodyLimit({
  maxSize: 2 * 1024 * 1024,
  onError: (context) => context.json({ error: 'PAYLOAD_TOO_LARGE' }, 413),
}))

app.get('/health', (context) => context.json({ ok: true }))

app.get('/api/local-token', (context) => {
  context.header('Cache-Control', 'no-store')
  return context.json({ token: localApiToken })
})

app.get('/api/stt/providers', (context) => {
  const providers = listSttProviders(process.env)
    .filter((provider) => provider.configured && provider.mode === 'realtime')
  return context.json({ providers })
})

app.post('/api/stt/direct/session', issueIflytekDirectSession)

app.post('/api/llm', async (context) => {
  const body = (await context.req.json().catch(() => null)) as {
    context?: ConversationTurn[]
    level?: string
    conversationLang?: string
    meaningLang?: string
  } | null
  if (!body || !Array.isArray(body.context)) return context.json({ error: 'INVALID_CONTEXT' }, 400)
  const { context: turns, level, conversationLang, meaningLang } = body

  return streamSSE(context, async (stream) => {
    try {
      const messages = await buildReplySuggestionsMessages({
        context: turns,
        level: parseLearnerLevel(level, 'beginner'),
        conversationLang: parseAppLanguage(conversationLang, 'ja'),
        meaningLang: parseAppLanguage(meaningLang, 'zh'),
      })
      const prompt = messages.map(({ role, content }) => `${role.toUpperCase()}:\n${content}`).join('\n\n')
      await stream.writeSSE({ event: 'prompt', data: prompt })
      const client = createLlmClient(llmConfigFromEnv(process.env))
      for await (const token of client.streamChat({ messages, signal: context.req.raw.signal })) {
        await stream.writeSSE({ event: 'token', data: token })
      }
    } catch (cause) {
      if (!context.req.raw.signal.aborted) {
        await stream.writeSSE({
          event: 'error',
          data: cause instanceof Error ? cause.message : String(cause),
        }).catch(() => {})
      }
    }
  })
})

app.all('/api/*', (context) => context.notFound())
app.use('/*', serveStatic({ root: '../web/dist' }))
app.get('*', serveStatic({ root: '../web/dist', path: './index.html' }))
