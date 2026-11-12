import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import {
  dashscopeRealtimeConfigFromEnv,
  dashscopeRealtimeHeaders,
  dashscopeRealtimeUpstreamUrl,
  parseThinClientMessage,
  thinClientToUpstream,
  upstreamToThinServer,
} from '@kibotalk/stt'
import { WebSocket, WebSocketServer } from 'ws'
import { isLoopbackHost, isLoopbackOrigin, localApiToken } from './local-access'

const SAMPLE_RATE = 16_000
const MAX_TURN_SECONDS = 30
const MAX_WEBSOCKET_MESSAGE_BYTES = 2 * 1024 * 1024

export function attachSttRealtimeUpgrade(server: Server): WebSocketServer {
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES,
  })

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host
    const origin = request.headers.origin
    if (!isLoopbackHost(host) || (origin && origin !== 'null' && !isLoopbackOrigin(origin))) {
      socket.destroy()
      return
    }
    const url = new URL(request.url ?? '/', `http://${host}`)
    if (url.pathname !== '/api/stt-realtime' || url.searchParams.get('token') !== localApiToken) {
      socket.destroy()
      return
    }
    websocketServer.handleUpgrade(request, socket as Duplex, head, (websocket) => {
      websocketServer.emit('connection', websocket, request)
    })
  })

  websocketServer.on('connection', (clientWebsocket, request) => {
    handleConnection(clientWebsocket, request)
  })

  return websocketServer
}

function handleConnection(
  clientWebsocket: WebSocket,
  request: IncomingMessage,
): void {
  const host = request.headers.host ?? 'localhost'
  const url = new URL(request.url ?? '/', `http://${host}`)
  const provider = url.searchParams.get('provider') ?? 'dashscope-realtime'
  const language = url.searchParams.get('language') ?? undefined

  const send = (message: unknown) => {
    if (clientWebsocket.readyState === WebSocket.OPEN) {
      clientWebsocket.send(JSON.stringify(message))
    }
  }

  if (provider !== 'dashscope-realtime') {
    send({ type: 'error', code: 'STT_PROVIDER_NOT_ACTIVE', message: '该连接只接受 DashScope 实时转写' })
    clientWebsocket.close()
    return
  }

  let config
  try {
    config = dashscopeRealtimeConfigFromEnv(process.env)
  } catch (cause) {
    send({ type: 'error', code: 'STT_NOT_CONFIGURED', message: (cause as Error).message })
    clientWebsocket.close()
    return
  }

  let upstream: WebSocket
  try {
    upstream = new WebSocket(dashscopeRealtimeUpstreamUrl(config), {
      headers: Object.fromEntries(
        dashscopeRealtimeHeaders(config.apiKey).map((header) => {
          const separator = header.indexOf(':')
          return [header.slice(0, separator).trim(), header.slice(separator + 1).trim()] as const
        }),
      ),
    })
  } catch (cause) {
    send({ type: 'error', code: 'UPSTREAM_CONNECT_FAILED', message: (cause as Error).message })
    clientWebsocket.close()
    return
  }

  let closed = false
  let upstreamOpen = false
  let currentTurnSamples = 0
  const pendingClient: ReturnType<typeof parseThinClientMessage>[] = []
  const forwardToUpstream = (
    message: Exclude<ReturnType<typeof parseThinClientMessage>, { error: string }>,
  ) => {
    for (const event of thinClientToUpstream(message)) {
      upstream.send(JSON.stringify(event))
    }
  }

  const closeBoth = () => {
    if (closed) return
    closed = true
    try {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close()
      }
    } catch {
      // Closing is best-effort.
    }
    try {
      if (clientWebsocket.readyState === WebSocket.OPEN) clientWebsocket.close()
    } catch {
      // Closing is best-effort.
    }
  }

  upstream.on('open', () => {
    upstreamOpen = true
    for (const item of pendingClient) {
      if ('error' in item) continue
      forwardToUpstream(item)
    }
    pendingClient.length = 0
  })

  upstream.on('message', (data) => {
    const event = upstreamToThinServer(data.toString())
    if (!event) return
    send(event)
    if (event.type === 'error' && event.code !== 'TRANSCRIPTION_FAILED') closeBoth()
  })

  upstream.on('error', (error) => {
    send({ type: 'error', code: 'UPSTREAM_ERROR', message: error.message })
    closeBoth()
  })

  upstream.on('close', (code, reason) => {
    if (!closed) {
      const detail = reason.toString()
      send({
        type: 'error',
        code: 'UPSTREAM_CLOSED',
        message: detail
          ? `实时转写上游已断开（${code}）：${detail}`
          : `实时转写上游已断开（${code}）`,
      })
    }
    closeBoth()
  })

  clientWebsocket.on('message', (data) => {
    const raw = typeof data === 'string' ? data : data.toString('utf8')
    const parsed = parseThinClientMessage(raw)
    if ('error' in parsed) {
      send({ type: 'error', code: 'INVALID_CLIENT_MESSAGE', message: parsed.error })
      return
    }
    const message =
      parsed.type === 'session.start' && !parsed.language && language
        ? { ...parsed, language }
        : parsed
    if (message.type === 'append') {
      const audioBytes = Buffer.from(message.audio, 'base64').byteLength
      const samples = audioBytes / 2
      if (
        audioBytes === 0
        || !Number.isInteger(samples)
        || currentTurnSamples + samples > SAMPLE_RATE * MAX_TURN_SECONDS
      ) {
        send({
          type: 'error',
          code: 'TURN_AUDIO_LIMIT',
          message: `单轮音频不能超过 ${MAX_TURN_SECONDS} 秒`,
        })
        closeBoth()
        return
      }
      currentTurnSamples += samples
    } else if (message.type === 'commit') {
      currentTurnSamples = 0
    }
    if (!upstreamOpen) {
      pendingClient.push(message)
      return
    }
    forwardToUpstream(message)
  })

  clientWebsocket.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN) {
      try {
        for (const event of thinClientToUpstream({ type: 'finish' })) {
          upstream.send(JSON.stringify(event))
        }
      } catch {
        // Upstream may already be gone.
      }
    }
    setTimeout(closeBoth, 500)
  })

  clientWebsocket.on('error', closeBoth)
}
