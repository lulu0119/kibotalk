import { useEffect, useRef, useState } from 'react'
import type { PipelineEvent } from '@kibotalk/pipeline'
import { Pipeline } from '@kibotalk/pipeline'
import type {
  ConversationSession,
  ConversationSessionSnapshot,
  ConversationStorage,
  ConversationTurn,
  ReplyCandidate,
} from '@kibotalk/conversation'
import { InMemoryConversationStorage } from '@kibotalk/conversation'
import { EmbeddingSpeakerVerifier, stabilizeSpeaker, type EmbeddingStorage } from '@kibotalk/speaker'
import type { ReplyTextStream } from '@kibotalk/llm'
import { beginSpan, trackPath, type TraceSink } from '@proj-airi/trace-kit'
import { VoiceAttributes, VoiceTracks } from '@proj-airi/trace-kit/voice'
import { createSpeechEngine } from '../audio/speech-engine'
import { selectTranscriptionModel } from '../audio/local-models'
import { createWorkerEmbedAudio } from '../audio/speaker-embed'
import { localizedSessionTitle } from '../i18n'
import { createCurrentSpeakerEmbeddingStorage } from '../speaker-embedding-storage'
import { browserReplyModel, createReplyClient, type SessionLanguageSnapshot } from '../reply-model'
import { createSessionCapture, type SessionCapture } from './capture-session'

export type SessionTurn = ConversationTurn & { candidates?: ReplyCandidate[] }

export type SessionDraft = {
  speaker: 'user' | 'other'
  text: string
  startedAt: number
  endedAt: number
}

export type CandidateRound = { id: string; candidates: ReplyCandidate[] }

export type ProductSessionLifecycle = 'restoring' | 'stopped' | 'starting' | 'running' | 'paused'

/** The knobs `defaultAppConfig` hardcodes for product apps and the playground exposes as sliders. */
export type ConversationSessionParams = {
  speechThreshold: number
  minSilenceDurationMs: number
  minSpeechDurationMs: number
  pauseMs: number
  mergeMaxMs: number
  speakerThreshold: number
  sttEnabled: boolean
  replyEnabled: boolean
  languageSnapshot: SessionLanguageSnapshot
  replyStream?: ReplyTextStream
  speakerEmbeddingStorage?: EmbeddingStorage
  trace?: TraceSink
  /** Defaults to a fresh `InMemoryConversationStorage` (playground behavior). */
  storage?: ConversationStorage
  /** Product shells persist lifecycle/history; playground sessions stay ephemeral. */
  persistSessionLifecycle?: boolean
  /** Full settings snapshot frozen when a persisted session begins. */
  sessionSnapshot?: ConversationSessionSnapshot
  /** Allow an unclassified microphone input, used by the playground. */
  allowUnenrolledMicrophone?: boolean
  /** System-audio stream factory supplied by the host. */
  getSystemAudioStream?: () => Promise<MediaStream>
  stopSystemAudioStream?: () => Promise<void>
  /** Receives the 16 kHz frame before the speech worker takes ownership. Copy it to keep it. */
  onAudioFrame?: Parameters<typeof createSessionCapture>[0]['onAudioFrame']
}

/**
 * The full live-session orchestration: mic capture → VAD → speaker
 * verification and Sherpaw transcription → TurnGate merge →
 * `ingestFinalizedTurn` → LLM reply candidates via `Pipeline`.
 */
export function useConversationSession(params: ConversationSessionParams) {
  const [running, setRunning] = useState(false)
  const [loadingModel, setLoadingModel] = useState<{ name: string; percent?: number } | null>(null)
  const [error, setError] = useState('')
  const [state, setState] = useState('IDLE')
  const [turns, setTurns] = useState<SessionTurn[]>([])
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [candidateRounds, setCandidateRounds] = useState<CandidateRound[]>([])
  const [vadStatus, setVadStatus] = useState<'idle' | 'speech' | 'silence'>('idle')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [lifecycle, setLifecycle] = useState<ProductSessionLifecycle>(
    params.persistSessionLifecycle ? 'restoring' : 'stopped',
  )
  const [activeSession, setActiveSession] = useState<ConversationSession | null>(null)
  const [recoveredUnexpectedPause, setRecoveredUnexpectedPause] = useState(false)

  const paramsRef = useRef(params)
  paramsRef.current = params
  const storageRef = useRef<ConversationStorage | null>(null)
  const storage = (storageRef.current ??= params.storage ?? new InMemoryConversationStorage())
  const captureRef = useRef<SessionCapture | null>(null)
  const pipelineRef = useRef<Pipeline | null>(null)
  const startingRef = useRef<AbortController | null>(null)
  const pipelineWorkRef = useRef(Promise.resolve())
  const teardownRef = useRef<Promise<void> | null>(null)
  const pauseRef = useRef<(reason?: 'user' | 'unexpected') => Promise<void>>(async () => {})
  pauseRef.current = pause

  useEffect(() => {
    if (!params.persistSessionLifecycle) return
    let cancelled = false
    void storage.getActiveSession()
      .then(async (session) => {
        if (cancelled) return
        if (!session) {
          setLifecycle('stopped')
          return
        }
        const restored =
          session.status === 'running'
            ? await storage.pauseActiveSession('unexpected')
            : session
        if (cancelled || !restored) return
        setTurns(
          restored.turns.map((turn) => ({
            ...turn,
            ...(turn.suggestions ? { candidates: turn.suggestions } : {}),
          })),
        )
        setCandidateRounds(
          restored.turns
            .filter((turn) => turn.suggestions?.length)
            .map((turn) => ({ id: turn.id, candidates: turn.suggestions! }))
            .reverse(),
        )
        setActiveSession(restored)
        setRecoveredUnexpectedPause(restored.pauseReason === 'unexpected')
        setLifecycle('paused')
      })
      .catch((cause) => {
        if (cancelled) return
        setError(String(cause))
        setLifecycle('stopped')
      })
    return () => {
      cancelled = true
    }
    // Storage is fixed for the lifetime of one product shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    captureRef.current?.updateTurnGate(params.pauseMs, params.mergeMaxMs)
  }, [params.pauseMs, params.mergeMaxMs])

  async function start(options: { resume?: boolean } = {}) {
    if (startingRef.current || teardownRef.current || captureRef.current) return
    const starting = new AbortController()
    startingRef.current = starting
    const signal = starting.signal
    const p = paramsRef.current
    const snapshot = options.resume && activeSession ? activeSession.snapshot : p.sessionSnapshot
    const languageSnapshot = snapshot ?? p.languageSnapshot
    const source = snapshot?.audioSource ?? 'microphone'
    const model = selectTranscriptionModel(languageSnapshot.conversationLang)

    setError('')
    setLoadingModel({ name: model.name })
    setLifecycle('starting')
    setDraft(null)
    let startedPersistedSession = false
    let capture: SessionCapture | undefined
    try {
      const verifier = new EmbeddingSpeakerVerifier({
        embedAudio: createWorkerEmbedAudio(),
        storage: p.speakerEmbeddingStorage ?? createCurrentSpeakerEmbeddingStorage(),
        threshold: p.speakerThreshold,
      })
      const embedding = source === 'microphone' ? await verifier.loadEmbedding() : null
      if (source === 'microphone' && !embedding && !p.allowUnenrolledMicrophone) throw new Error('VOICEPRINT_REQUIRED')
      signal.throwIfAborted()
      const engine = await createSpeechEngine(model, {
        threshold: p.speechThreshold,
        minSpeechMs: p.minSpeechDurationMs,
        minSilenceMs: p.minSilenceDurationMs,
        maxSpeechMs: p.mergeMaxMs,
      }, source === 'both' ? 2 : 1, signal, (fraction) => {
        if (!signal.aborted) setLoadingModel({ name: model.name, percent: Math.round(fraction * 100) })
      })

      const shouldGenerateReply = () => paramsRef.current.replyEnabled
      const llm = createReplyClient(
        languageSnapshot,
        shouldGenerateReply,
        p.replyStream ?? browserReplyModel.stream,
        setError,
      )
      const pipeline = new Pipeline({ llm, conversation: storage, shouldGenerateReply, trace: p.trace })
      pipeline.on((event: PipelineEvent) => {
        switch (event.type) {
          case 'state':
            setState(event.state)
            break
          case 'turnAppended':
            setTurns((previous) => [...previous, event.turn])
            break
          case 'candidatesDone': {
            if (!paramsRef.current.replyEnabled || event.candidates.length !== 3) break
            setError('')
            setCandidateRounds((previous) => [{ id: event.turnId, candidates: event.candidates }, ...previous])
            setTurns((previous) => previous.map((turn) =>
              turn.id === event.turnId ? { ...turn, candidates: event.candidates } : turn))
            void storage.updateTurnSuggestions(event.turnId, event.candidates)
              .catch((cause) => setError(String(cause)))
            break
          }
        }
      })

      let stableSpeaker: 'user' | 'other' = 'other'
      capture = createSessionCapture({
        engine,
        source,
        language: languageSnapshot.conversationLang,
        microphoneDeviceId: snapshot?.microphoneDeviceId,
        getSystemAudioStream: p.getSystemAudioStream,
        stopSystemAudioStream: p.stopSystemAudioStream,
        signal,
        pauseMs: p.pauseMs,
        maxMs: p.mergeMaxMs,
        transcriptionEnabled: () => paramsRef.current.sttEnabled,
        async verifySpeaker(pcm) {
          // Short VAD fragments lack enough speech for CAM++ to score reliably.
          if (!embedding || pcm.length < 16000) return stableSpeaker
          const verification = p.trace && beginSpan(p.trace, {
            track: trackPath(VoiceTracks.Speech, { actor: stableSpeaker }),
            name: 'speaker.verify',
          })
          try {
            const threshold = paramsRef.current.speakerThreshold
            verifier.setThreshold(threshold)
            const result = await verifier.verify(pcm.buffer as ArrayBuffer, embedding)
            verification?.end({ attrs: { [VoiceAttributes.SpeakerScore]: result.similarity } })
            setConfidence(result.confidence)
            stableSpeaker = stabilizeSpeaker(result.similarity, stableSpeaker, threshold)
          } catch (cause) {
            verification?.end({ status: 'error' })
            setError(String(cause))
          }
          return stableSpeaker
        },
        onTurn(turn) {
          pipelineWorkRef.current = pipelineWorkRef.current
            .then(() => pipeline.ingestFinalizedTurn(turn))
            .catch((cause) => setError(String(cause)))
        },
        onDraft: setDraft,
        onAudioFrame: p.onAudioFrame,
        onSpeech: (speaking) => setVadStatus(speaking ? 'speech' : 'silence'),
        onDeviceEnded: () => { void pauseRef.current('unexpected') },
        onError: setError,
        trace: p.trace,
      })
      captureRef.current = capture
      pipelineRef.current = pipeline
      signal.throwIfAborted()
      if (p.persistSessionLifecycle) {
        if (!snapshot) throw new Error('MISSING_SESSION_SNAPSHOT')
        const startedAt = Date.now()
        const session = options.resume
          ? await storage.resumeActiveSession()
          : await storage.startSession({
              id: crypto.randomUUID(),
              startedAt,
              snapshot,
              title: localizedSessionTitle({ startedAt, snapshot }),
            })
        if (!session) throw new Error('NO_SESSION_TO_RESUME')
        startedPersistedSession = true
        setActiveSession(session)
      }
      signal.throwIfAborted()
      if (!options.resume) {
        setTurns([])
        setCandidateRounds([])
      }
      await capture.start()
      signal.throwIfAborted()
      setRecoveredUnexpectedPause(false)
      setRunning(true)
      setLifecycle('running')
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
      if (capture) await capture.stop(false).catch(() => {})
      else if (source !== 'microphone') await p.stopSystemAudioStream?.().catch(() => {})
      captureRef.current = null
      pipelineRef.current = null
      if (startedPersistedSession) {
        const session = options.resume
          ? await storage.pauseActiveSession('unexpected')
          : await storage.stopActiveSession()
        setActiveSession(session)
      }
      setLifecycle(options.resume ? 'paused' : 'stopped')
    } finally {
      startingRef.current = null
      setLoadingModel(null)
    }
  }

  async function finishCapture(): Promise<void> {
    if (teardownRef.current) return teardownRef.current
    const capture = captureRef.current
    const pipeline = pipelineRef.current
    const teardown = (async () => {
      try {
        await capture?.stop(true)
        await pipelineWorkRef.current
        await pipeline?.idle()
      } finally {
        captureRef.current = null
        pipelineRef.current = null
        setDraft(null)
        setRunning(false)
        setVadStatus('idle')
        setConfidence(null)
      }
    })()
    teardownRef.current = teardown
    try {
      await teardown
    } finally {
      teardownRef.current = null
    }
  }

  async function pause(reason: 'user' | 'unexpected' = 'user') {
    if (startingRef.current) {
      startingRef.current.abort()
      return
    }
    if (!captureRef.current || teardownRef.current) return
    await finishCapture()
    if (paramsRef.current.persistSessionLifecycle) {
      setActiveSession(await storage.pauseActiveSession(reason))
    }
    setRecoveredUnexpectedPause(reason === 'unexpected')
    setLifecycle('paused')
  }

  async function resume() {
    if (lifecycle === 'paused') await start({ resume: true })
  }

  async function stop() {
    if (startingRef.current) {
      startingRef.current.abort()
      return
    }
    await finishCapture()
    if (paramsRef.current.persistSessionLifecycle) {
      setActiveSession(await storage.stopActiveSession())
    }
    setRecoveredUnexpectedPause(false)
    setLifecycle('stopped')
  }

  async function interrupt() {
    await pause('unexpected')
  }

  async function clearSession() {
    await storage.clearActiveSession()
    setTurns([])
    setDraft(null)
    setCandidateRounds([])
    setState('IDLE')
    setActiveSession(null)
    setRecoveredUnexpectedPause(false)
    setLifecycle('stopped')
  }

  const modelDownloadPercent = loadingModel?.percent
  const loading = loadingModel
    ? modelDownloadPercent === undefined ? loadingModel.name : `${loadingModel.name} · ${modelDownloadPercent}%`
    : ''

  return {
    running,
    loading,
    modelDownloadPercent,
    error,
    state,
    turns,
    draft,
    candidateRounds,
    vadStatus,
    confidence,
    lifecycle,
    activeSession,
    recoveredUnexpectedPause,
    start,
    pause,
    resume,
    stop,
    interrupt,
    clearSession,
  }
}
