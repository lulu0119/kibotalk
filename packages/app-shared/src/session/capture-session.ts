import { createSegmentAggregator, type SegmentAggregator } from '@kibotalk/audio/aggregator'
import type { AppLanguage, SessionAudioSource } from '@kibotalk/conversation'
import type { FinalizedTurnInput } from '@kibotalk/pipeline'
import { beginSpan, trackPath, type TraceSink, type TraceSpan } from '@proj-airi/trace-kit'
import { VoiceAttributes, VoiceNames, VoiceTracks } from '@proj-airi/trace-kit/voice'
import { AudioSource } from '../audio/audio-source'
import type { SpeechEngine } from '../audio/speech-engine'
import type { SpeechSegment, SpeechUpdate } from '../audio/speech.worker'
import { finalizedTurnFromRealtimeSegments, type TranscribedAudioSegment } from './realtime-turn'

type Speaker = 'user' | 'other'
type Draft = { speaker: Speaker; text: string; startedAt: number; endedAt: number }

type CaptureOptions = {
  engine: SpeechEngine
  source: SessionAudioSource
  language: AppLanguage
  microphoneDeviceId?: string
  getSystemAudioStream?: () => Promise<MediaStream>
  stopSystemAudioStream?: () => Promise<void>
  signal: AbortSignal
  pauseMs: number
  maxMs: number
  verifySpeaker: (pcm: Float32Array) => Promise<Speaker>
  transcriptionEnabled: () => boolean
  onTurn: (turn: FinalizedTurnInput) => void
  onDraft: (draft: Draft | null) => void
  onSpeech: (speaking: boolean) => void
  onAudioFrame?: (source: Exclude<SessionAudioSource, 'both'>, pcm: Float32Array) => void
  onDeviceEnded: () => void
  onError: (message: string) => void
  trace?: TraceSink
}

type Lane = {
  audio: AudioSource
  aggregator: SegmentAggregator<TranscribedAudioSegment>
  index: number
  system: boolean
  speaking: boolean
  enabled: boolean
  draft?: Draft
  recognition?: TraceSpan
}

export function createSessionCapture(options: CaptureOptions) {
  const lanes: Lane[] = []
  let queued = Promise.resolve()
  let closing = false
  let shutdown: Promise<void> | undefined
  let previousSpeaker: Speaker = 'other'

  function error(cause: unknown) {
    options.onError(cause instanceof Error ? cause.message : String(cause))
  }

  function publishDraft() {
    const latest = lanes.find((lane) => lane.draft?.speaker === 'user')?.draft
      ?? lanes.find((lane) => lane.draft)?.draft
    options.onDraft(latest ?? null)
  }

  function queueSegments(lane: Lane, segments: SpeechSegment[]) {
    for (const segment of segments) {
      queued = queued.then(async () => {
        if (!segment.text) return
        const speaker = lane.system
          ? 'other'
          : options.source === 'both' ? 'user' : await options.verifySpeaker(segment.pcm)
        previousSpeaker = speaker
        const trace = options.trace
        if (trace) {
          const now = trace.now()
          const duration = segment.endedAt - segment.startedAt
          const speech = beginSpan(trace, {
            track: trackPath(VoiceTracks.Speech, { actor: speaker }),
            name: VoiceNames.SpeechSegment,
            ts: now - Math.max(0, Date.now() - segment.startedAt),
            attrs: { [VoiceAttributes.SpeechDurationMs]: duration },
            ids: { actor: speaker },
          })
          speech.end({ ts: now - Math.max(0, Date.now() - segment.endedAt) })
        }
        lane.aggregator.feed({
          buffer: segment.pcm,
          text: segment.text,
          startedAt: segment.startedAt,
          endedAt: segment.endedAt,
          speaker,
        })
      }).catch(error)
    }
  }

  function accept(lane: Lane, update: SpeechUpdate) {
    if (update.segments.length) {
      lane.recognition?.end()
      lane.recognition = undefined
      lane.draft = undefined
    }
    const changed = lane.speaking !== update.speaking
    lane.speaking = update.speaking
    if (changed && update.speaking) {
      lane.aggregator.hold()
      if (options.trace) {
        const actor = lane.system ? 'other' : options.source === 'both' ? 'user' : previousSpeaker
        lane.recognition = beginSpan(options.trace, {
          track: trackPath(VoiceTracks.ASR, { actor }),
          name: VoiceNames.SpeechRecognition,
          ids: { actor },
        })
      }
    }
    queueSegments(lane, update.segments)
    if (changed && !update.speaking) {
      lane.draft = undefined
      // The silence timer starts when verification and the final transcript reach TurnGate.
      queued = queued.then(() => {
        if (!lane.speaking) lane.aggregator.resume()
      })
      lane.recognition?.end()
      lane.recognition = undefined
    }
    if (closing) return
    if (changed) options.onSpeech(lanes.some((candidate) => candidate.speaking))
    const draft = update.draft
    if (draft && (draft.text !== lane.draft?.text || draft.startedAt !== lane.draft.startedAt)) {
      lane.draft = {
        ...draft,
        speaker: lane.system ? 'other' : options.source === 'both' ? 'user' : previousSpeaker,
        endedAt: Date.now(),
      }
      if (draft.text) lane.recognition?.instant(VoiceNames.TranscriptPartial)
    }
    if (changed || draft || update.segments.length) publishDraft()
  }

  async function startLane(system: boolean) {
    const stream = system ? await options.getSystemAudioStream?.() : undefined
    if (options.signal.aborted) {
      stream?.getTracks().forEach((track) => track.stop())
      options.signal.throwIfAborted()
    }
    if (system && !stream) throw new Error('SYSTEM_AUDIO_UNAVAILABLE')
    const audio = new AudioSource({
      stream,
      deviceId: options.microphoneDeviceId,
      echoCancellation: !system,
      onDeviceEnded: options.onDeviceEnded,
    })
    const aggregator = createSegmentAggregator<TranscribedAudioSegment>({
      sampleRate: audio.sampleRate,
      pauseMs: options.pauseMs,
      maxMs: options.maxMs,
    })
    aggregator.onFlush((segments) => {
      const turn = finalizedTurnFromRealtimeSegments(segments, options.language)
      if (!turn) return
      const trace = options.trace
      if (trace) {
        const holdMs = Math.max(0, Date.now() - turn.endedAt)
        const gate = beginSpan(trace, {
          track: trackPath(VoiceTracks.Endpoint, { conversation: 'live' }),
          name: VoiceNames.EndpointJudgement,
          ts: trace.now() - holdMs,
          ids: { actor: turn.speaker },
        })
        gate.instant(VoiceNames.TurnEnded, { [VoiceAttributes.EndpointTranscriptLength]: turn.text.length })
        gate.end()
      }
      options.onTurn(turn)
    })
    const lane: Lane = {
      index: lanes.length, audio, aggregator, system, speaking: false, enabled: false,
    }
    lanes.push(lane)
    await audio.start((pcm) => {
      if (closing) return
      options.onAudioFrame?.(system ? 'system' : 'microphone', pcm)
      if (!options.transcriptionEnabled()) {
        if (lane.enabled) {
          lane.enabled = false
          lane.draft = undefined
          lane.speaking = false
          lane.aggregator.resume()
          lane.recognition?.end({ status: 'cancelled' })
          lane.recognition = undefined
          void options.engine.reset(lane.index).catch(error)
          publishDraft()
          options.onSpeech(lanes.some((candidate) => candidate.speaking))
        }
        return
      }
      lane.enabled = true
      void options.engine.process(lane.index, pcm).then((update) => {
        if (lane.enabled) accept(lane, update)
      }).catch((cause) => {
        if (closing) return
        error(cause)
        options.onDeviceEnded()
      })
    }, options.signal)
  }

  return {
    async start() {
      await startLane(options.source === 'system')
      if (options.source === 'both') await startLane(true)
    },
    updateTurnGate(pauseMs: number, maxMs: number) {
      for (const { aggregator } of lanes) aggregator.updateConfig({ pauseMs, maxMs })
    },
    stop(finalize: boolean): Promise<void> {
      if (shutdown) return shutdown
      closing = true
      for (const { audio } of lanes) audio.stop()
      shutdown = (async () => {
        try {
          if (finalize) {
            await Promise.all(lanes.map(async (lane) => {
              if (!lane.enabled) return
              try {
                queueSegments(lane, await options.engine.finish(lane.index))
              } catch (cause) {
                error(cause)
              }
            }))
            await queued
            for (const { aggregator } of lanes) aggregator.flush()
          }
        } finally {
          for (const lane of lanes) {
            lane.aggregator.dispose()
            lane.recognition?.end({ status: finalize ? 'ok' : 'cancelled' })
          }
          options.engine.dispose()
          if (options.source !== 'microphone') await options.stopSystemAudioStream?.()
        }
      })()
      return shutdown
    },
  }
}

export type SessionCapture = ReturnType<typeof createSessionCapture>
