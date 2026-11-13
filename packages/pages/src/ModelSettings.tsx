import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { AppLanguage } from '@kibotalk/conversation'
import {
  browserReplyModel,
  downloadTranscriptionModel,
  modelIsDownloaded,
  saveTranscriptionModel,
  selectTranscriptionOption,
  useI18n,
} from '@kibotalk/app-shared'
import { emptyLlmSettings, readLlmSettings, type LlmSettings, type LlmSettingsStore, type ReplyModelHost } from '@kibotalk/llm'
import {
  Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Input, Label, Progress, SearchSelect,
} from '@kibotalk/ui'
import { AltArrowDownIcon, ArrowRightIcon, ArrowRightUpIcon, CheckIcon, MagnifierIcon, PlugCircleIcon } from '@kibotalk/ui/icons'
import { availableTextProtocols, isTextProtocol, loadCatalog, route, type Provider } from '@kibotalk/llm/catalog'
import { OnboardingActions, OnboardingSteps } from './OnboardingNavigation'
import { TranscriptionModelPicker } from './TranscriptionModelPicker'

const customProviderId = '__custom'
const popularProviderIds = ['openai', 'anthropic', 'google', 'deepseek', 'openrouter']
type SaveError = 'modelSettingsError' | 'replyModelTestFailed' | 'replyModelBrowserError'

function ProviderLogo({ providerId }: { providerId?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex size-8 shrink-0 items-center justify-center text-foreground">
      {providerId && !failed ? (
        <img
          className="size-5 object-contain dark:invert"
          src={`https://models.dev/logos/${encodeURIComponent(providerId)}.svg`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          alt=""
        />
      ) : <PlugCircleIcon className="size-5" />}
    </span>
  )
}

export function ReplyModelSettings({
  store = browserReplyModel.settings,
  onSaved,
  onboarding,
}: {
  store?: LlmSettingsStore
  onSaved?: () => void
  onboarding?: {
    onBack: () => void
    test: ReplyModelHost['test']
    returnToConfiguration?: boolean
    downloadError?: ReactNode
  }
}) {
  const { t } = useI18n()
  const id = useId()
  const [settings, setSettings] = useState<LlmSettings>(emptyLlmSettings)
  const [providers, setProviders] = useState<Provider[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loaded, setLoaded] = useState(false)
  const [choosingProvider, setChoosingProvider] = useState(true)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<'saved' | SaveError>()
  const activeSave = useRef<AbortController | null>(null)
  const openSavedConfiguration = !onboarding || onboarding.returnToConfiguration === true

  useEffect(() => {
    let active = true
    void store.load().then((saved) => {
      if (!active) return
      setSettings(saved)
      if (saved.providerId || saved.baseURL) {
        setSelectedProviderId(saved.providerId || customProviderId)
        setChoosingProvider(!openSavedConfiguration)
      }
      setLoaded(true)
    }).catch(() => {
      if (!active) return
      setLoaded(true)
      setResult('modelSettingsError')
    })
    void loadCatalog().then((catalog) => {
      if (!active) return
      setProviders(catalog)
      setCatalogStatus('ready')
    }).catch(() => {
      if (active) setCatalogStatus('error')
    })
    return () => {
      active = false
      activeSave.current?.abort()
    }
  }, [store, openSavedConfiguration])

  function update(patch: Partial<LlmSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }))
    setResult(undefined)
  }

  const provider = providers.find((entry) => entry.id === settings.providerId)
  const search = query.trim().toLowerCase()
  const displayedProviders = search
    ? providers.filter(({ id, name }) => `${name} ${id}`.toLowerCase().includes(search))
    : popularProviderIds.map((providerId) => providers.find((entry) => entry.id === providerId))
      .filter((entry) => entry !== undefined)
  if (!search && provider && !displayedProviders.includes(provider)) displayedProviders.push(provider)
  const options = displayedProviders.map(({ id, name }) => ({ id, name }))
  if (!search && settings.providerId && !provider) {
    options.push({ id: settings.providerId, name: settings.providerId })
  }
  const customProviderName = t('customProviderShort')
  if (!search || `${t('customProvider')} custom openai-compatible`.toLowerCase().includes(search)) {
    options.push({ id: customProviderId, name: customProviderName })
  }
  const models = provider
    ? Object.values(provider.models).filter((model) => availableTextProtocols(provider, model).length)
    : []

  function confirmProvider() {
    const providerId = selectedProviderId
    if (providerId === (settings.providerId || customProviderId) && (settings.model || settings.baseURL)) {
      setChoosingProvider(false)
      return
    }
    if (providerId === customProviderId) {
      update({ ...emptyLlmSettings, path: undefined })
      setChoosingProvider(false)
      return
    }
    const chosen = providers.find((entry) => entry.id === providerId)
    if (!chosen) return
    const model = Object.values(chosen.models).find((entry) => availableTextProtocols(chosen, entry).length)
    if (!model) return
    const target = route(chosen, model.id, availableTextProtocols(chosen, model))
    if (!isTextProtocol(target.protocol)) return
    update({
      providerId, model: '', baseURL: target.baseURL, protocol: target.protocol,
      path: target.path, apiKey: '',
    })
    setChoosingProvider(false)
  }

  function openProviderPicker() {
    setSelectedProviderId(settings.providerId || customProviderId)
    setQuery('')
    setResult(undefined)
    setChoosingProvider(true)
  }

  function modelChanged(modelId: string) {
    const known = provider?.models[modelId]
    if (!provider || !known) {
      update({ model: modelId })
      return
    }
    const protocols = availableTextProtocols(provider, known)
    if (!protocols.length) {
      update({ model: modelId })
      return
    }
    const target = route(provider, modelId, protocols)
    if (!isTextProtocol(target.protocol)) return
    const previousModel = provider.models[settings.model] ?? models[0]
    const previousURL = previousModel?.routes[settings.protocol]?.baseURL
    update({
      model: modelId,
      protocol: target.protocol,
      path: target.path,
      baseURL: previousURL && settings.baseURL.replace(/\/+$/, '') === previousURL.replace(/\/+$/, '')
        ? target.baseURL : settings.baseURL,
    })
  }

  async function save() {
    if (activeSave.current) return
    const operation = new AbortController()
    activeSave.current = operation
    setPending(true)
    setResult(undefined)
    let error: SaveError = 'modelSettingsError'
    try {
      const draft = readLlmSettings(settings)
      const url = new URL(draft.baseURL)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Invalid URL')
      }
      if (onboarding) {
        error = 'replyModelTestFailed'
        await onboarding.test(draft)
      }
      if (operation.signal.aborted) return
      error = 'modelSettingsError'
      await store.save(draft)
      if (operation.signal.aborted) return
      setResult('saved')
      onSaved?.()
    } catch (cause) {
      if (operation.signal.aborted) return
      const browserConnection = error === 'replyModelTestFailed'
        && cause instanceof Error && cause.message === 'LLM_BROWSER_CONNECTION'
      setResult(browserConnection ? 'replyModelBrowserError' : error)
    } finally {
      activeSave.current = null
      if (!operation.signal.aborted) setPending(false)
    }
  }

  const errorMessage = result && result !== 'saved' && (
    <p role="alert" className="text-sm text-destructive">{t(result)}</p>
  )
  const layout = onboarding ? 'flex flex-1 flex-col gap-4' : 'space-y-4'
  if (choosingProvider) {
    const canContinue = loaded && options.some((option) => option.id === selectedProviderId)
    const next = (
      <Button type="button" disabled={!canContinue} onClick={confirmProvider}>
        {t('nextStep')} <ArrowRightIcon />
      </Button>
    )
    return (
      <div className={layout}>
        {onboarding && <OnboardingSteps step={2} />}
        <h1 className={onboarding ? 'text-xl font-semibold' : 'sr-only'}>{t('chooseProvider')}</h1>
        <div className="relative">
          <MagnifierIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t('searchProvider')}
            placeholder={t('searchProvider')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={!loaded || catalogStatus !== 'ready'}
            className="pl-9"
          />
        </div>
        <div className="max-h-44 overflow-y-auto p-0.5" role="group" aria-label={t('chooseProvider')}>
          <div className="grid grid-cols-2 gap-2.5">
            {options.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="outline"
                aria-pressed={item.id === selectedProviderId}
                className="h-12 min-w-0 justify-start gap-1.5 px-2 text-left aria-pressed:border-primary aria-pressed:bg-primary/10 sm:gap-2 sm:px-2.5"
                disabled={!loaded}
                onClick={() => setSelectedProviderId(item.id)}
              >
                <ProviderLogo providerId={item.id === customProviderId ? undefined : item.id} />
                <span className="truncate" title={item.name}>{item.name}</span>
                {item.id === selectedProviderId && <CheckIcon className="ml-auto !size-3.5 text-foreground" />}
              </Button>
            ))}
          </div>
        </div>
        {catalogStatus !== 'ready' && <p role="status" className="text-sm text-muted-foreground">
          {t(catalogStatus === 'loading' ? 'providerCatalogLoading' : 'providerCatalogUnavailable')}
        </p>}
        {catalogStatus === 'ready' && !options.length && <p role="status" className="text-sm text-muted-foreground">{t('noModelMatches')}</p>}
        {errorMessage}
        {onboarding?.downloadError}
        {onboarding ? <OnboardingActions onBack={onboarding.onBack}>{next}</OnboardingActions> : next}
      </div>
    )
  }

  const requiresKey = Boolean(provider?.apiKeyEnv?.length)
  const requireKeyForSetup = Boolean(onboarding) && requiresKey
  const canSubmit = !pending && settings.baseURL.trim() && settings.model.trim()
    && (!requireKeyForSetup || settings.apiKey.trim())
  const submitLabel = pending ? 'testingReplyModel' : 'nextStep'
  const submit = (
    <Button type="submit" disabled={!canSubmit}>
      {t(onboarding ? submitLabel : 'saveModelSettings')}
      {onboarding && !pending && <ArrowRightIcon />}
    </Button>
  )
  const baseURL = (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-url`}>Base URL</Label>
      <Input id={`${id}-url`} type="url" value={settings.baseURL}
        placeholder="http://localhost:11434/v1" required disabled={pending}
        onChange={(event) => update({ baseURL: event.target.value })} />
    </div>
  )

  return (
    <form className={layout} onSubmit={(event) => { event.preventDefault(); void save() }}>
      {onboarding && <OnboardingSteps step={3} />}
      <div className="flex items-center gap-2.5">
        <ProviderLogo key={settings.providerId} providerId={settings.providerId} />
        <h1 className={onboarding ? 'min-w-0 flex-1 text-xl font-semibold' : 'min-w-0 flex-1 text-sm font-medium'}>
          {provider?.name || settings.providerId || t('customProvider')}
        </h1>
        {!onboarding && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={openProviderPicker}>
          {t('changeProvider')}
        </Button>}
      </div>
      {(!onboarding || !provider) && baseURL}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${id}-key`}>API Key {!requiresKey && <span className="text-muted-foreground">({t('optional')})</span>}</Label>
          {provider?.doc && /^https?:\/\//i.test(provider.doc) && (
            <a href={provider.doc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
              {t('providerDocs')} <ArrowRightUpIcon className="size-3.5" />
            </a>
          )}
        </div>
        <Input id={`${id}-key`} type="password" autoComplete="off" value={settings.apiKey}
          required={requireKeyForSetup} disabled={pending} onChange={(event) => update({ apiKey: event.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-model`}>{t('model')}</Label>
        <SearchSelect
          id={`${id}-model`}
          value={settings.model}
          options={models.map((item) => ({
            value: item.id,
            label: item.name,
            description: item.id === item.name ? undefined : item.id,
          }))}
          placeholder={t('chooseModel')}
          searchLabel={t('searchModel')}
          emptyLabel={t('noModelMatches')}
          customLabel={(value) => `${t('useCustomModel')} ${value}`}
          onChange={modelChanged}
          disabled={pending}
        />
      </div>
      {onboarding && provider && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button type="button" size="sm" variant="ghost" disabled={pending} className="group -ml-3 text-muted-foreground">
              {t('connectionSettings')} <AltArrowDownIcon className="group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">{baseURL}</CollapsibleContent>
        </Collapsible>
      )}
      {errorMessage}
      {onboarding?.downloadError}
      {onboarding ? (
        <OnboardingActions onBack={openProviderPicker} disabled={pending}>{submit}</OnboardingActions>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {submit}
          {result === 'saved' && <span role="status" className="text-sm">{t('modelSettingsSaved')}</span>}
        </div>
      )}
    </form>
  )
}

export function TranscriptionModelSettings({ language, systemLanguages, locked = false }: {
  language: AppLanguage
  systemLanguages?: readonly AppLanguage[]
  locked?: boolean
}) {
  const { t } = useI18n()
  const [preferred, setPreferred] = useState<string>()
  const option = selectTranscriptionOption(language, systemLanguages, preferred)
  const model = 'files' in option ? option : undefined
  const [downloaded, setDownloaded] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setDownloaded(false)
    setError(false)
    if (!model) return
    void modelIsDownloaded(model).then((ready) => {
      if (active) setDownloaded(ready)
    }).catch(() => {})
    return () => { active = false }
  }, [model])

  async function download() {
    if (!model) return
    setError(false)
    setProgress(0)
    try {
      await downloadTranscriptionModel(model, setProgress)
      setDownloaded(true)
    } catch {
      setError(true)
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="space-y-3">
      <TranscriptionModelPicker
        language={language}
        systemLanguages={systemLanguages}
        value={option.id}
        disabled={locked || progress !== null}
        onChange={(id) => {
          saveTranscriptionModel(id)
          setPreferred(id)
        }}
      />
      {model && <div className="flex items-center gap-3 text-sm">
        {downloaded ? <span role="status">{t('modelDownloaded')}</span> : (
          <Button variant="outline" onClick={() => void download()} disabled={progress !== null}>
            {t('downloadModel')} · {Math.round(model.files[0].bytes / 1_000_000)} MB
          </Button>
        )}
        {progress !== null ? <Progress className="min-w-0 flex-1" value={progress * 100} aria-label={t('downloadModel')} /> : null}
      </div>}
      {error ? <p role="alert" className="text-sm text-destructive">{t('modelDownloadError')}</p> : null}
    </div>
  )
}
