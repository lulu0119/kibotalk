import { useEffect, useMemo, useState } from 'react'
import type { AppLanguage, UiLanguage } from '@kibotalk/conversation'
import {
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
  WizardScreen,
} from '@kibotalk/ui'
import { ArrowRightIcon, TranslateIcon } from '@kibotalk/ui/icons'
import { EnrollmentPage } from './EnrollmentPage'
import { TranscriptionModelPicker } from './TranscriptionModelPicker'

const languages: AppLanguage[] = ['ja', 'en', 'zh']

type PrepareModels = (onProgress: (progress: number) => void) => Promise<unknown>
type DownloadState =
  | { status: 'downloading'; percent: number }
  | { status: 'ready' }
  | { status: 'error' }

function useModelDownload(prepare: PrepareModels | undefined) {
  const [state, setState] = useState<DownloadState>({ status: 'downloading', percent: 0 })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!prepare) return
    let active = true
    setState({ status: 'downloading', percent: 0 })
    void prepare((progress) => {
      const percent = Math.floor(progress * 100)
      if (!active) return
      setState((current) => {
        if (current.status !== 'downloading' || current.percent === percent) return current
        return { status: 'downloading', percent }
      })
    }).then(() => {
      if (active) setState({ status: 'ready' })
    }, () => {
      if (active) setState({ status: 'error' })
    })
    return () => { active = false }
  }, [prepare, attempt])

  return { ...state, retry: () => setAttempt((previous) => previous + 1) }
}

function DownloadStatus({ label, download }: { label: string; download: ReturnType<typeof useModelDownload> }) {
  const { t } = useI18n()
  if (download.status === 'ready') return null

  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {download.status === 'error' ? (
          <Button size="sm" variant="outline" onClick={download.retry}>{t('retry')}</Button>
        ) : (
          <span className="tabular-nums">{download.percent}%</span>
        )}
      </div>
      {download.status === 'error' ? (
        <p role="alert" className="text-destructive">{t('modelDownloadError')}</p>
      ) : (
        <Progress value={download.percent} aria-label={label} />
      )}
    </div>
  )
}

export type OnboardingPageProps = {
  prefs: LanguagePrefs
  enrolled: boolean
  onPrefsChange: (prefs: LanguagePrefs) => void
  onComplete: () => void
  embedded?: boolean
  requestMicrophone?: () => Promise<boolean>
}

export function OnboardingPage({ prefs, enrolled, onPrefsChange, onComplete, embedded, requestMicrophone }: OnboardingPageProps) {
  const { t, language } = useI18n()
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
  const baseStatus = <DownloadStatus label={t('baseSpeechModels')} download={base} />

  if (confirmedModel) {
    return (
      <EnrollmentPage
        embedded={embedded}
        conversationLang={prefs.conversationLang}
        enrolled={enrolled}
        onEnterSession={onComplete}
        requestMicrophone={requestMicrophone}
        enterDisabled={base.status !== 'ready' || transcription.status !== 'ready'}
      >
        {baseStatus}
        <DownloadStatus label={confirmedModel.name} download={transcription} />
      </EnrollmentPage>
    )
  }

  function confirmModel() {
    try {
      saveTranscriptionModel(model.id)
    } catch {
      setSelectionError(true)
      return
    }
    setConfirmedModel(model)
  }

  return (
    <WizardScreen embedded={embedded} className="space-y-6 p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
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
            <ToggleGroupItem key={option} value={option}>
              {languageLabel(option, language)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <TranscriptionModelPicker language={prefs.conversationLang} value={model.id} onChange={setModelId} />
      {baseStatus}
      {selectionError ? <p role="alert" className="text-sm text-destructive">{t('modelSettingsError')}</p> : null}
      <Button className="w-full" size="lg" onClick={confirmModel}>
        {t('downloadAndContinue')}
        <ArrowRightIcon />
      </Button>
    </WizardScreen>
  )
}
