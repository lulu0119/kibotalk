import { useEffect, useMemo, useState } from 'react'
import type { AppLanguage, UiLanguage } from '@kibotalk/conversation'
import type { ReplyModelHost } from '@kibotalk/llm'
import {
  browserReplyModel,
  downloadTranscriptionModel,
  languageLabel,
  prepareBaseSpeechModels,
  saveTranscriptionModel,
  selectTranscriptionModel,
  transcriptionModels,
  useI18n,
  type LanguagePrefs,
  type TranscriptionModel,
} from '@kibotalk/app-shared'
import {
  Button,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from '@kibotalk/ui'
import { ArrowRightIcon, DownloadIcon, TranslateIcon } from '@kibotalk/ui/icons'
import { EnrollmentForm } from './EnrollmentPage'
import { ReplyModelSettings } from './ModelSettings'
import { OnboardingActions, OnboardingSteps } from './OnboardingNavigation'
import { OnboardingScreen } from './OnboardingScreen'
import { TranscriptionModelPicker } from './TranscriptionModelPicker'

const languages: AppLanguage[] = ['ja', 'en', 'zh']

type PrepareModels = (onProgress: (progress: number) => void) => Promise<unknown>
type DownloadState =
  | { status: 'downloading'; percent: number }
  | { status: 'ready' }
  | { status: 'error' }

const initialDownload: DownloadState = { status: 'downloading', percent: 0 }

function useModelDownload(prepare: PrepareModels | undefined) {
  const [result, setResult] = useState<{ prepare: PrepareModels; state: DownloadState }>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!prepare) return
    let active = true
    const update = (state: DownloadState) => {
      if (active) setResult({ prepare, state })
    }
    let lastPercent = -1
    void prepare((progress) => {
      const percent = Math.floor(progress * 100)
      if (lastPercent === percent) return
      lastPercent = percent
      update({ status: 'downloading', percent })
    }).then(() => {
      update({ status: 'ready' })
    }, () => {
      update({ status: 'error' })
    })
    return () => { active = false }
  }, [prepare, attempt])

  const state = result && result.prepare === prepare ? result.state : initialDownload
  return {
    ...state,
    retry() {
      setResult(undefined)
      setAttempt((previous) => previous + 1)
    },
  }
}

export function OnboardingDownloadIndicator({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="flex w-40 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-muted-foreground shadow-sm">
      <DownloadIcon className="size-3.5 shrink-0" aria-hidden />
      <Progress value={percent} aria-label={label} className="h-1.5" />
    </div>
  )
}

export type OnboardingDownloadProgress = { label: string; percent: number } | null

export type OnboardingPageProps = {
  prefs: LanguagePrefs
  enrolled: boolean
  onPrefsChange: (prefs: LanguagePrefs) => void
  onComplete: () => void
  embedded?: boolean
  requestMicrophone?: () => Promise<boolean>
  replyModel?: Pick<ReplyModelHost, 'settings' | 'test'>
  onDownloadProgress?: (progress: OnboardingDownloadProgress) => void
}

export function OnboardingPage({
  prefs, enrolled, onPrefsChange, onComplete, embedded, requestMicrophone,
  replyModel = browserReplyModel, onDownloadProgress,
}: OnboardingPageProps) {
  const { t, language } = useI18n()
  const [step, setStep] = useState<'speech' | 'reply' | 'edit-reply' | 'voice'>('speech')
  const [recorded, setRecorded] = useState(false)
  const [modelId, setModelId] = useState(() => selectTranscriptionModel(prefs.conversationLang).id)
  const [confirmedModel, setConfirmedModel] = useState<TranscriptionModel>()
  const [selectionError, setSelectionError] = useState(false)
  const model = transcriptionModels.find((item) => item.id === modelId && item.languages.includes(prefs.conversationLang))
    ?? selectTranscriptionModel(prefs.conversationLang)
  const base = useModelDownload(prepareBaseSpeechModels)
  const prepareTranscription = useMemo<PrepareModels | undefined>(() => {
    if (confirmedModel) return (onProgress) => downloadTranscriptionModel(confirmedModel, onProgress)
  }, [confirmedModel])
  const transcription = useModelDownload(prepareTranscription)
  const modelsReady = base.status === 'ready' && transcription.status === 'ready'
  const failedDownloads = (confirmedModel ? [base, transcription] : [base])
    .filter((download) => download.status === 'error')
  const downloadLabel = base.status === 'downloading' ? t('baseSpeechModels') : confirmedModel?.name
  const activeDownload = base.status === 'downloading' ? base : transcription
  const percent = activeDownload.status === 'downloading' ? activeDownload.percent : undefined
  const downloadProgress = useMemo<OnboardingDownloadProgress>(
    () => downloadLabel && percent !== undefined ? { label: downloadLabel, percent } : null,
    [downloadLabel, percent],
  )

  useEffect(() => {
    onDownloadProgress?.(downloadProgress)
  }, [downloadProgress, onDownloadProgress])

  useEffect(() => () => onDownloadProgress?.(null), [onDownloadProgress])

  function confirmModel() {
    try {
      saveTranscriptionModel(model.id)
    } catch {
      setSelectionError(true)
      return
    }
    setSelectionError(false)
    setConfirmedModel(model)
    setStep('reply')
  }

  const progress = !onDownloadProgress && downloadProgress && (
    <div className="pointer-events-none fixed right-4 top-4 z-40">
      <OnboardingDownloadIndicator {...downloadProgress} />
    </div>
  )
  const error = failedDownloads.length > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
      <p role="alert" className="text-sm text-destructive">{t('modelDownloadError')}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => failedDownloads.forEach((download) => download.retry())}>
        {t('retry')}
      </Button>
    </div>
  )
  return (
    <>
      {progress}
      <OnboardingScreen embedded={embedded}>
        {step === 'speech' && (
          <>
            <OnboardingSteps step={1} />
            <header className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">{t('setupConversation')}</h1>
              <Select value={prefs.uiLang} onValueChange={(value) => onPrefsChange({ ...prefs, uiLang: value as UiLanguage })}>
                <SelectTrigger className="h-9 w-auto gap-2" aria-label={t('uiLanguage')}>
                  <TranslateIcon className="size-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </header>
            <div className="space-y-2">
              <Label id="setup-conversation-language">{t('conversationLanguage')}</Label>
              <ToggleGroup
                type="single"
                variant="chip"
                aria-labelledby="setup-conversation-language"
                value={prefs.conversationLang}
                onValueChange={(value) => {
                  if (value) onPrefsChange({ ...prefs, conversationLang: value as AppLanguage })
                }}
              >
                {languages.map((option) => (
                  <ToggleGroupItem key={option} value={option}>{languageLabel(option, language)}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <TranscriptionModelPicker language={prefs.conversationLang} value={model.id} onChange={setModelId} />
            {selectionError && <p role="alert" className="text-sm text-destructive">{t('modelSettingsError')}</p>}
            {error}
            <OnboardingActions>
              <Button type="button" onClick={confirmModel}>{t('nextStep')} <ArrowRightIcon /></Button>
            </OnboardingActions>
          </>
        )}
        {(step === 'reply' || step === 'edit-reply') && (
          <ReplyModelSettings
            store={replyModel.settings}
            onSaved={() => setStep('voice')}
            onboarding={{
              test: replyModel.test,
              onBack: () => setStep('speech'),
              returnToConfiguration: step === 'edit-reply',
              downloadError: error,
            }}
          />
        )}
        {step === 'voice' && (
          <EnrollmentForm
            conversationLang={prefs.conversationLang}
            enrolled={enrolled || recorded}
            onEnrolled={() => setRecorded(true)}
            onEnterSession={onComplete}
            requestMicrophone={requestMicrophone}
            recordDisabled={base.status !== 'ready'}
            enterDisabled={!modelsReady}
            onboarding={{ onBack: () => setStep('edit-reply'), downloadError: error }}
          />
        )}
      </OnboardingScreen>
    </>
  )
}
