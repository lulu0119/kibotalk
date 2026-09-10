import { beforeEach, describe, expect, it } from 'vitest'
import {
  acquireLlmSlot,
  acquireWebsocket,
  releaseLlmSlot,
  releaseWebsocket,
  resetAiSessionStateForTests,
} from '../src/ai-session-state'

const identity = {
  userId: 'user-1',
  deviceSessionId: 'device-1',
  conversationSessionId: 'session-1',
}

beforeEach(resetAiSessionStateForTests)

describe('ai session state', () => {
  it('allows one in-flight LLM request per conversation session', () => {
    expect(acquireLlmSlot(identity)).toBe(true)
    expect(acquireLlmSlot(identity)).toBe(false)
    releaseLlmSlot(identity)
    expect(acquireLlmSlot(identity)).toBe(true)
  })

  it('allows two websocket streams for desktop both-audio mode', () => {
    expect(acquireWebsocket(identity)).toBe(true)
    expect(acquireWebsocket(identity)).toBe(true)
    expect(acquireWebsocket(identity)).toBe(false)
    releaseWebsocket(identity)
    expect(acquireWebsocket(identity)).toBe(true)
  })
})
