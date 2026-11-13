import { useEffect, useId, useState } from 'react'
import type { AppLanguage } from '@kibotalk/conversation'
import {
  browserReplyModel,
  downloadTranscriptionModel,
  modelIsDownloaded,
  saveTranscriptionModel,
  selectTranscriptionModel,
  useI18n,
} from '@kibotalk/app-shared'
import { emptyLlmSettings, type LlmSettings, type LlmSettingsStore } from '@kibotalk/llm'
import {
  Button, Input, Label, Progress, SearchSelect,
} from '@kibotalk/ui'
import { availableTextProtocols, isTextProtocol, loadCatalog, route, type Provider } from '@kibotalk/llm/catalog'
import { TranscriptionModelPicker } from './TranscriptionModelPicker'

export function ReplyModelSettings({
  store = browserReplyModel.settings,
  onSaved,
}: {
  store?: LlmSettingsStore
  onSaved?: () => void
}) {
  const { t } = useI18n()
  const id = useId()
  const [settings, setSettings] = useState<LlmSettings>(emptyLlmSettings)
  const [providers, setProviders] = useState<Provider[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    let active = true
    void store.load().then((saved) => {
      if (!active) return
      setSettings(saved)
      setLoaded(true)
    }).catch(() => {
      if (!active) return
      setLoaded(true)
      setResult('error')
    })
    void loadCatalog().then((catalog) => {
      if (!active) return
      setProviders(catalog)
      setCatalogStatus('ready')
    }).catch(() => {
      if (active) setCatalogStatus('error')
    })
    return () => { active = false }
  }, [store])

  function update(patch: Partial<LlmSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }))
    setResult('idle')
  }

  const provider = providers.find((entry) => entry.id === settings.providerId)
  const models = provider
    ? Object.values(provider.models).filter((model) => availableTextProtocols(provider, model).length)
    : []

  function providerChanged(providerId: string) {
    if (providerId === '__custom') {
      update({ providerId: '', baseURL: '', model: '', protocol: 'chat', path: undefined, apiKey: '' })
      return
    }
    const chosen = providers.find((entry) => entry.id === providerId)
    if (!chosen) return
    const model = Object.values(chosen.models).find((entry) => availableTextProtocols(chosen, entry).length)
    if (!model) return
    const target = route(chosen, model.id, availableTextProtocols(chosen, model))
    if (!isTextProtocol(target.protocol)) return
    update({
      providerId, model: target.model, baseURL: target.baseURL, protocol: target.protocol,
      path: target.path, apiKey: '',
    })
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
    const previousURL = provider.models[settings.model]?.routes[settings.protocol]?.baseURL
    update({
      model: modelId,
      protocol: target.protocol,
      path: target.path,
      baseURL: previousURL && settings.baseURL.replace(/\/+$/, '') === previousURL.replace(/\/+$/, '')
        ? target.baseURL : settings.baseURL,
    })
  }

  async function save() {
    setSaving(true)
    try {
      const url = new URL(settings.baseURL)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Invalid URL')
      }
      await store.save(settings)
      setResult('saved')
      onSaved?.()
    } catch {
      setResult('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save() }}>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-provider`}>{t('provider')}</Label>
        <SearchSelect
          id={`${id}-provider`}
          value={settings.providerId || '__custom'}
          options={[
            { value: '__custom', label: t('customProvider') },
            ...providers.map((item) => ({ value: item.id, label: item.name })),
          ]}
          placeholder={t('provider')}
          searchLabel={t('searchProvider')}
          emptyLabel={t('noModelMatches')}
          onChange={providerChanged}
          disabled={!loaded || saving}
        />
        {catalogStatus !== 'ready' ? (
          <p className="text-xs text-muted-foreground">
            {t(catalogStatus === 'loading' ? 'providerCatalogLoading' : 'providerCatalogUnavailable')}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-url`}>Base URL</Label>
        <Input id={`${id}-url`} type="url" value={settings.baseURL}
          placeholder="http://localhost:11434/v1" required disabled={!loaded || saving}
          onChange={(event) => update({ baseURL: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-key`}>API Key <span className="text-muted-foreground">({t('optional')})</span></Label>
        <Input id={`${id}-key`} type="password" autoComplete="off" value={settings.apiKey}
          disabled={!loaded || saving} onChange={(event) => update({ apiKey: event.target.value })} />
      </div>
      <div className="grid gap-2">
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
          disabled={!loaded || saving}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!loaded || saving || !settings.baseURL.trim() || !settings.model.trim()}>
          {t('saveModelSettings')}
        </Button>
        {result === 'saved' ? <span role="status" className="text-sm">{t('modelSettingsSaved')}</span> : null}
        {result === 'error' ? <span role="alert" className="text-sm text-destructive">{t('modelSettingsError')}</span> : null}
      </div>
    </form>
  )
}

export function TranscriptionModelSettings({ language, locked = false }: { language: AppLanguage; locked?: boolean }) {
  const { t } = useI18n()
  const [model, setModel] = useState(() => selectTranscriptionModel(language))
  const [downloaded, setDownloaded] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setModel(selectTranscriptionModel(language))
  }, [language])

  useEffect(() => {
    let active = true
    setDownloaded(false)
    setError(false)
    void modelIsDownloaded(model).then((ready) => {
      if (active) setDownloaded(ready)
    }).catch(() => {})
    return () => { active = false }
  }, [model])

  async function download() {
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
        value={model.id}
        disabled={locked || progress !== null}
        onChange={(id) => {
          saveTranscriptionModel(id)
          setModel(selectTranscriptionModel(language))
        }}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {downloaded ? <span role="status">{t('modelDownloaded')}</span> : (
          <Button variant="outline" onClick={() => void download()} disabled={progress !== null}>
            {t('downloadModel')} · {Math.round(model.files[0].bytes / 1_000_000)} MB
          </Button>
        )}
        {progress !== null ? <Progress className="max-w-48" value={progress * 100} aria-label={t('downloadModel')} /> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{t('modelDownloadError')}</p> : null}
    </div>
  )
}
