import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationSessionSnapshot, ConversationStorage } from '@kibotalk/conversation'
import { defaultAppConfig } from '../config'
import type { SessionLanguageSnapshot } from '../reply-model'
import type { ReplyTextStream } from '@kibotalk/llm'
import {
  useConversationSession,
  type CandidateRound,
  type ProductSessionLifecycle,
} from './use-conversation-session'

export type ProductSessionParams = {
  languageSnapshot: SessionLanguageSnapshot
  sessionSnapshot?: ConversationSessionSnapshot
  getSystemAudioStream?: () => Promise<MediaStream>
  stopSystemAudioStream?: () => Promise<void>
  /** Defaults to an in-memory session (playground behavior); product apps pass a persisted `ConversationStorage`. */
  storage?: ConversationStorage
  replyStream?: ReplyTextStream
}

/**
 * The live session every product surface (`apps/web`'s
 * `SessionPage`, `apps/desktop`'s Island) drives identically. It supplies
 * `defaultAppConfig`, interrupts on unmount and derives the newest-first candidate rounds
 * for `StickyNoteStack`. Only the surrounding JSX differs per surface.
 */
export function useProductSession({
  languageSnapshot,
  sessionSnapshot,
  getSystemAudioStream,
  stopSystemAudioStream,
  storage,
  replyStream,
}: ProductSessionParams) {
  const [replyEnabled, setReplyEnabled] = useState(true)
  const previousLifecycleRef = useRef<ProductSessionLifecycle>('restoring')

  const session = useConversationSession({
    speechThreshold: defaultAppConfig.vad.speechThreshold,
    minSilenceDurationMs: defaultAppConfig.vad.minSilenceDurationMs,
    minSpeechDurationMs: defaultAppConfig.vad.minSpeechDurationMs,
    pauseMs: defaultAppConfig.aggregator.pauseMs,
    mergeMaxMs: defaultAppConfig.aggregator.maxMs,
    speakerThreshold: defaultAppConfig.speakerThreshold,
    replyStream,
    sttEnabled: true,
    replyEnabled,
    languageSnapshot,
    sessionSnapshot,
    getSystemAudioStream,
    stopSystemAudioStream,
    storage,
    persistSessionLifecycle: !!storage && !!sessionSnapshot,
  })
  const interruptRef = useRef(session.interrupt)
  interruptRef.current = session.interrupt

  useEffect(() => {
    const previous = previousLifecycleRef.current
    previousLifecycleRef.current = session.lifecycle
    if (
      session.lifecycle === 'stopped' &&
      (previous === 'running' || previous === 'paused')
    ) {
      setReplyEnabled(true)
    }
  }, [session.lifecycle])

  useEffect(() => {
    return () => {
      void interruptRef.current()
    }
  }, [])

  const rounds: CandidateRound[] = useMemo(
    () =>
      session.turns
        .filter((t) => t.candidates && t.candidates.length > 0)
        .map((t) => ({ id: t.id, candidates: t.candidates! }))
        .reverse(),
    [session.turns],
  )

  function requestSessionStart() {
    void session.start()
  }

  return {
    session,
    rounds,
    replyEnabled,
    setReplyEnabled,
    requestSessionStart,
  }
}

export type ProductSessionController = ReturnType<typeof useProductSession>
