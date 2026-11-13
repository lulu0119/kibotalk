import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  EmbeddingSpeakerVerifier,
  EnrollmentAudioError,
} from '@kibotalk/speaker'
import type { AppLanguage } from '@kibotalk/conversation'
import {
  AudioSource,
  createCurrentSpeakerEmbeddingStorage,
  createWorkerEmbedAudio,
  loadModelFile,
  speakerModelFile,
  PASSPHRASE_BY_LANG,
  defaultAppConfig,
  useI18n,
} from '@kibotalk/app-shared'
import { Button, LevelMeter, WizardScreen } from '@kibotalk/ui'
import { ArrowRightIcon, MicrophoneIcon, RestartIcon, StopIcon } from '@kibotalk/ui/icons'
import { OnboardingActions, OnboardingSteps } from './OnboardingNavigation'

/** RMS mapped through a sqrt curve so typical speech (quiet in raw RMS terms) still visibly moves the meter. */
function levelFromChunk(chunk: Float32Array): number {
  let sumSquares = 0
  for (const sample of chunk) sumSquares += sample * sample
  const rms = Math.sqrt(sumSquares / chunk.length)
  return Math.min(1, Math.sqrt(rms) * 2.2)
}

type EnrollmentFormProps = {
  conversationLang: AppLanguage
  enrolled?: boolean
  onEnterSession: () => void
  enterDisabled?: boolean
  onboarding?: { onBack: () => void; downloadError?: ReactNode }
  onEnrolled?: () => void
  recordDisabled?: boolean
  requestMicrophone?: () => Promise<boolean>
}

export type EnrollmentPageProps = EnrollmentFormProps & { embedded?: boolean }

export function EnrollmentPage({ embedded, ...props }: EnrollmentPageProps) {
  return (
    <WizardScreen embedded={embedded} className="space-y-5 p-5 sm:p-6">
      <EnrollmentForm {...props} />
    </WizardScreen>
  )
}

type RecordingPhase = 'idle' | 'starting' | 'recording' | 'processing' | 'saved'

export function EnrollmentForm({
  conversationLang,
  enrolled,
  onEnterSession,
  enterDisabled,
  onboarding,
  onEnrolled,
  recordDisabled,
  requestMicrophone,
}: EnrollmentFormProps) {
  const [phase, setPhase] = useState<RecordingPhase>(enrolled ? 'saved' : 'idle')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const { t } = useI18n()
  const passphrase = PASSPHRASE_BY_LANG[conversationLang]
  const verifierRef = useRef<EmbeddingSpeakerVerifier | null>(null)
  const audioRef = useRef<AudioSource | null>(null)
  const recordingStart = useRef<AbortController | null>(null)
  const chunksRef = useRef<Float32Array[]>([])

  function verifier() {
    return (verifierRef.current ??= new EmbeddingSpeakerVerifier({
      embedAudio: createWorkerEmbedAudio(),
      storage: createCurrentSpeakerEmbeddingStorage(),
      threshold: defaultAppConfig.speakerThreshold,
    }))
  }

  useEffect(() => {
    return () => {
      recordingStart.current?.abort()
      audioRef.current?.stop()
      audioRef.current = null
    }
  }, [])

  async function beginRecording() {
    if (recordingStart.current) return
    const controller = new AbortController()
    recordingStart.current = controller
    setError('')
    setPhase('starting')
    chunksRef.current = []
    try {
      if (requestMicrophone && !(await requestMicrophone())) throw new Error('Microphone permission denied')
      controller.signal.throwIfAborted()
      const audio = new AudioSource()
      audioRef.current = audio
      await audio.start((chunk) => {
        chunksRef.current.push(chunk)
        setLevel(levelFromChunk(chunk))
      }, controller.signal)
      setPhase('recording')
    } catch {
      if (!controller.signal.aborted) setError(t('microphoneAccessError'))
      audioRef.current?.stop()
      audioRef.current = null
      setPhase('idle')
    } finally {
      recordingStart.current = null
    }
  }

  async function stopRecording() {
    if (phase !== 'recording') return
    const chunks = chunksRef.current
    chunksRef.current = []
    audioRef.current?.stop()
    audioRef.current = null
    setLevel(0)

    if (chunks.every((chunk) => chunk.length === 0)) {
      setPhase('idle')
      setError(t('noAudioRecorded'))
      return
    }

    setPhase('processing')
    try {
      await loadModelFile(speakerModelFile)
      await verifier().enroll((async function* () {
        for (const chunk of chunks) yield chunk.slice().buffer
      })(), passphrase)
      setPhase('saved')
      onEnrolled?.()
    } catch (cause) {
      const message =
        cause instanceof EnrollmentAudioError
          ? t(cause.code === 'too-short' ? 'voiceprintTooShort' : 'voiceprintTooQuiet')
          : t('voiceprintFailed')
      setError(message)
      setPhase('idle')
    }
  }

  const saved = phase === 'saved'
  const recording = phase === 'recording'
  const busy = phase === 'starting' || phase === 'processing'
  const recordingButtonClass = onboarding ? undefined : 'w-full'
  let primaryAction: ReactNode
  if (recording) {
    primaryAction = (
      <Button className={recordingButtonClass} variant="destructive" onClick={() => void stopRecording()}>
        <StopIcon />
        {t('stopRecording')}
      </Button>
    )
  } else if (busy) {
    primaryAction = (
      <p role="status" className="text-sm text-muted-foreground">
        {t(phase === 'starting' ? 'preparingMicrophone' : 'processing')}
      </p>
    )
  } else if (!saved) {
    primaryAction = (
      <Button className={recordingButtonClass} disabled={recordDisabled} onClick={() => void beginRecording()}>
        <MicrophoneIcon />
        {t(error ? 'retryRecording' : 'startRecording')}
      </Button>
    )
  } else {
    primaryAction = (
      <Button onClick={onEnterSession} disabled={enterDisabled}>
        {t('enterSession')} <ArrowRightIcon />
      </Button>
    )
  }

  let actions = primaryAction
  if (onboarding) {
    actions = (
      <OnboardingActions onBack={onboarding.onBack} disabled={busy || recording}>
        {primaryAction}
      </OnboardingActions>
    )
  } else if (saved) {
    actions = (
      <div className="flex flex-wrap gap-2">
        {primaryAction}
        <Button variant="soft" onClick={() => void beginRecording()}>
          <RestartIcon />
          {t('rerecord')}
        </Button>
      </div>
    )
  }

  return (
    <>
      {onboarding && <OnboardingSteps step={4} />}
      <h1 className="text-xl font-semibold">{t(saved ? 'voiceprintSaved' : 'recordVoiceTitle')}</h1>

      {!saved ? (
        <div className="space-y-4">
          {!onboarding && <p className="text-sm text-muted-foreground">{t('recordVoiceDescription')}</p>}
          <div className="rounded-md bg-foreground/6 p-4">
            <div className="mb-1.5 text-xs text-muted-foreground">{t('pleaseRead')}</div>
            <div className="text-lg font-bold leading-relaxed">{passphrase}</div>
          </div>

          {recording && <LevelMeter level={level} />}
        </div>
      ) : null}

      {onboarding?.downloadError}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {actions}
    </>
  )
}
