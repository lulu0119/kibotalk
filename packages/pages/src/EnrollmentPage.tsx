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

/** RMS mapped through a sqrt curve so typical speech (quiet in raw RMS terms) still visibly moves the meter. */
function levelFromChunk(chunk: Float32Array): number {
  let sumSquares = 0
  for (const sample of chunk) sumSquares += sample * sample
  const rms = Math.sqrt(sumSquares / chunk.length)
  return Math.min(1, Math.sqrt(rms) * 2.2)
}

export type EnrollmentPageProps = {
  conversationLang: AppLanguage
  enrolled?: boolean
  onEnterSession: () => void
  embedded?: boolean
  enterDisabled?: boolean
  children?: ReactNode
  requestMicrophone?: () => Promise<boolean>
}

type RecordingPhase = 'idle' | 'starting' | 'recording' | 'processing' | 'saved'

export function EnrollmentPage({
  conversationLang,
  enrolled,
  onEnterSession,
  embedded,
  enterDisabled,
  children,
  requestMicrophone,
}: EnrollmentPageProps) {
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
  let recordingControls: ReactNode
  if (phase === 'recording') {
    recordingControls = (
      <>
        <LevelMeter level={level} />
        <Button className="w-full" variant="destructive" onClick={() => void stopRecording()}>
          <StopIcon className="size-4" />
          {t('stopRecording')}
        </Button>
      </>
    )
  } else if (phase === 'starting' || phase === 'processing') {
    recordingControls = (
      <p role="status" className="text-center text-sm text-muted-foreground">
        {t(phase === 'starting' ? 'preparingMicrophone' : 'processing')}
      </p>
    )
  } else if (phase === 'idle') {
    recordingControls = (
      <Button className="w-full" size="lg" onClick={() => void beginRecording()}>
        <MicrophoneIcon className="size-4" />
        {t(error ? 'retryRecording' : 'startRecording')}
      </Button>
    )
  }

  return (
    <WizardScreen embedded={embedded} className="space-y-5 p-5 sm:p-6">
      <h1 className="text-xl font-semibold">{t(saved ? 'voiceprintSaved' : 'recordVoiceTitle')}</h1>

      {!saved ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('recordVoiceDescription')}</p>
          <div className="rounded-md bg-foreground/6 p-4">
            <div className="mb-1.5 text-xs text-muted-foreground">{t('pleaseRead')}</div>
            <div className="text-lg font-bold leading-relaxed">{passphrase}</div>
          </div>

          {recordingControls}
        </div>
      ) : null}

      {children}

      {saved ? (
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" size="lg" onClick={onEnterSession} disabled={enterDisabled}>
            <ArrowRightIcon className="size-4" />
            {t('enterSession')}
          </Button>
          <Button className="flex-1" variant="soft" size="lg" onClick={() => void beginRecording()}>
            <RestartIcon className="size-4" />
            {t('rerecord')}
          </Button>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </WizardScreen>
  )
}
