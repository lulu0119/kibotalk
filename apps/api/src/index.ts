import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import type { Server } from 'node:http'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { app } from './app'
import { attachSttRealtimeUpgrade } from './stt-realtime'

const envPath = resolve(process.cwd(), '../../.env')
if (existsSync(envPath)) loadEnvFile(envPath)

// Client aborts mid-SSE can reject after the Hono response has already closed.
process.on('unhandledRejection', (reason) => {
  const text = reason instanceof Error ? reason.message : String(reason)
  if (text.includes('Client connection prematurely closed')) return
  console.error('unhandledRejection', reason)
  process.exit(1)
})

const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 8787 }, (info) => {
  console.log(`KiboTalk listening on http://127.0.0.1:${info.port}`)
}) as Server
const websocketServer = attachSttRealtimeUpgrade(server)

function shutdown(): void {
  for (const socket of websocketServer.clients) socket.close()
  websocketServer.close()
  server.close()
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
