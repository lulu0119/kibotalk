import { describe, expect, it, vi } from 'vitest'
import type { SessionAudioSource, Speaker } from '@kibotalk/conversation'
import type { SpeechUpdate } from '../src/audio/speech.worker'
import { createSessionCapture } from '../src/session/capture-session'

const { listeners } = vi.hoisted(() => ({ listeners: [] as Array<(frame: Float32Array) => void> }))

vi.mock('../src/audio/audio-source', () => ({
  AudioSource: class {
    readonly sampleRate = 16000
    async start(onFrame: (frame: Float32Array) => void) { listeners.push(onFrame) }
    stop() {}
  },
}))

async function capture(source: SessionAudioSource) {
  listeners.length = 0
  const process = vi.fn<(lane: number, frame: Float32Array) => Promise<SpeechUpdate>>()
  const verifySpeaker = vi.fn<(pcm: Float32Array) => Promise<Speaker>>()
  const verifyDraftSpeaker = vi.fn<(pcm: Float32Array) => Promise<Speaker | null>>()
  const onDraft = vi.fn()
  const onTurn = vi.fn()
  const session = createSessionCapture({
    engine: { process, finish: async () => [], reset: async () => {}, dispose: () => {} },
    source,
    language: 'en',
    getSystemAudioStream: async () => new EventTarget() as MediaStream,
    signal: new AbortController().signal,
    pauseMs: 0,
    maxMs: 5000,
    transcriptionEnabled: () => true,
    verifySpeaker,
    verifyDraftSpeaker,
    onDraft,
    onTurn,
    onSpeech: () => {},
    onDeviceEnded: () => {},
    onError: (message) => { throw new Error(message) },
  })
  await session.start()
  return {
    session, verifySpeaker, verifyDraftSpeaker, onDraft, onTurn,
    async send(lane: number, update: SpeechUpdate) {
      process.mockResolvedValueOnce(update)
      listeners[lane](new Float32Array(512))
      await Promise.resolve()
    },
  }
}

describe('live transcript speaker labels', () => {
  it('adds a speaker to the latest draft text without waiting for the final turn', async () => {
    const { session, verifySpeaker, verifyDraftSpeaker, send, onDraft, onTurn } = await capture('microphone')
    const speakerPreview = new Float32Array(24000)
    const verification = Promise.withResolvers<Speaker | null>()
    verifyDraftSpeaker.mockReturnValueOnce(verification.promise)
    verifySpeaker.mockResolvedValueOnce('other')
    try {
      await send(0, { speaking: true, segments: [], speakerPreview, draft: { text: 'hello', startedAt: 0 } })
      expect(verifyDraftSpeaker).toHaveBeenCalledWith(speakerPreview)
      await send(0, { speaking: true, segments: [], draft: { text: 'hello there', startedAt: 0 } })
      expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'hello there', speaker: null }))
      verification.resolve('user')
      await verification.promise
      expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'hello there', speaker: 'user' }))
      expect(onTurn).not.toHaveBeenCalled()

      await send(0, { speaking: false, segments: [{ pcm: speakerPreview, text: 'hello there', startedAt: 0, endedAt: 1500 }] })
      await vi.waitFor(() => expect(onTurn).toHaveBeenCalledWith(expect.objectContaining({ text: 'hello there', speaker: 'other' })))
    } finally {
      await session.stop(false)
    }
  })

  it('discards a speaker prediction that arrives after the draft ended', async () => {
    const { session, verifySpeaker, verifyDraftSpeaker, send, onDraft } = await capture('microphone')
    const speakerPreview = new Float32Array(24000)
    const verification = Promise.withResolvers<Speaker | null>()
    verifyDraftSpeaker.mockReturnValueOnce(verification.promise)
    verifySpeaker.mockResolvedValueOnce('user')
    try {
      await send(0, { speaking: true, segments: [], speakerPreview, draft: { text: 'hello', startedAt: 0 } })
      await send(0, { speaking: false, segments: [{ pcm: speakerPreview, text: 'hello', startedAt: 0, endedAt: 1500 }] })
      await send(0, { speaking: true, segments: [], draft: { text: 'goodbye', startedAt: 2000 } })
      verification.resolve('user')
      await verification.promise
      expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'goodbye', speaker: null }))
    } finally {
      await session.stop(false)
    }
  })

  it('leaves each single-input draft unassigned until its own speech is verified', async () => {
    const { session, verifySpeaker, send, onDraft, onTurn } = await capture('microphone')
    const pcm = new Float32Array(16000)
    verifySpeaker.mockResolvedValueOnce('user').mockResolvedValueOnce('other')
    try {
      await send(0, { speaking: true, segments: [], draft: { text: 'hello', startedAt: 0 } })
      const firstDraft = onDraft.mock.lastCall?.[0]
      await send(0, { speaking: false, segments: [{ pcm, text: 'hello', startedAt: 0, endedAt: 1000 }] })
      await vi.waitFor(() => expect(onTurn).toHaveBeenCalledWith(expect.objectContaining({ text: 'hello', speaker: 'user' })))

      await send(0, { speaking: true, segments: [], draft: { text: 'hi', startedAt: 2000 } })
      const secondDraft = onDraft.mock.lastCall?.[0]
      await send(0, { speaking: false, segments: [{ pcm, text: 'hi', startedAt: 2000, endedAt: 3000 }] })
      await vi.waitFor(() => expect(onTurn).toHaveBeenCalledWith(expect.objectContaining({ text: 'hi', speaker: 'other' })))
      expect([firstDraft, secondDraft]).toEqual([
        expect.objectContaining({ text: 'hello', speaker: null }),
        expect.objectContaining({ text: 'hi', speaker: null }),
      ])
    } finally {
      await session.stop(false)
    }
  })

  it('labels the separate audio sources immediately', async () => {
    const { session, verifySpeaker, send, onDraft } = await capture('both')
    try {
      await send(1, { speaking: true, segments: [], draft: { text: 'system', startedAt: 0 } })
      expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'system', speaker: 'other' }))
      await send(0, { speaking: true, segments: [], draft: { text: 'mic', startedAt: 0 } })
      expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'mic', speaker: 'user' }))
      expect(verifySpeaker).not.toHaveBeenCalled()
    } finally {
      await session.stop(false)
    }
  })
})
