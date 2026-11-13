import { useCallback, useEffect, useState } from 'react'
import type { AppLanguage } from '@kibotalk/conversation'
import {
  createCurrentSpeakerEmbeddingStorage,
  createLocalConversationStorage,
  I18nProvider,
  loadLanguagePrefs,
  persistLanguagePrefs,
  useI18n,
  type LanguagePrefs,
} from '@kibotalk/app-shared'
import {
  EnrollmentPage,
  HistoryPage,
  OnboardingPage,
  SettingsPage,
} from '@kibotalk/pages'
import { WizardScreen } from '@kibotalk/ui'
import type {
  MediaAccessStatus,
  ProductWindowView,
} from '../shared/ipc'
import { desktopTranscription } from './apple-speech'

const desktopReplyModel = {
  settings: window.kibotalk.replyModel,
  test: window.kibotalk.replyModel.test,
}

type Gate = 'booting' | 'setup' | 'product'

function DesktopWindowContent({
  prefs,
  onPrefsChange,
}: {
  prefs: LanguagePrefs
  onPrefsChange: (prefs: LanguagePrefs) => void
}) {
  const { t } = useI18n()
  const [gate, setGate] = useState<Gate>('booting')
  const [view, setView] = useState<ProductWindowView>('settings')
  const [enrolled, setEnrolled] = useState<boolean | null>(null)
  const [systemLanguages, setSystemLanguages] = useState<readonly AppLanguage[] | null>(null)
  const [sessionActive, setSessionActive] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string>()
  const [microphonePermission, setMicrophonePermission] =
    useState<MediaAccessStatus>('unknown')
  const [screenPermission, setScreenPermission] = useState<MediaAccessStatus>('unknown')
  const [storage] = useState(() => createLocalConversationStorage(window.kibotalk.app.previousHistoryUserId))

  const refreshSessionState = useCallback(async () => {
    const session = await storage.getActiveSession()
    setSessionActive(!!session && session.status !== 'stopped')
    setActiveSessionId(session?.id)
  }, [storage])

  async function refreshPermissions() {
    const [microphone, screen] = await Promise.all([
      window.kibotalk.permissions.checkMicrophone(),
      window.kibotalk.permissions.checkScreenRecording(),
    ])
    setMicrophonePermission(microphone)
    setScreenPermission(screen)
  }

  useEffect(() => {
    let cancelled = false
    void desktopTranscription.languages().then((languages) => {
      if (!cancelled) setSystemLanguages(languages)
    })
    void window.kibotalk.onboarding.getStatus().then((status) => {
      if (cancelled) return
      setView(status.view)
      setGate(status.completed ? 'product' : 'setup')
      if (status.completed) {
        void refreshSessionState()
        void refreshPermissions()
      }
    })
    const unsubscribe = window.kibotalk.onboarding.onViewRequested((next) => {
      setView(next)
      void refreshSessionState()
      void refreshPermissions()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [refreshSessionState])

  useEffect(() => {
    if (gate !== 'setup') return
    let cancelled = false
    void createCurrentSpeakerEmbeddingStorage()
      .load()
      .then((embedding) => {
        if (!cancelled) setEnrolled(!!embedding)
      })
      .catch(() => {
        if (!cancelled) setEnrolled(false)
      })
    return () => {
      cancelled = true
    }
  }, [gate])

  useEffect(() => {
    if (gate === 'product' && !prefs.languagesConfirmed) {
      setGate('setup')
    }
  }, [gate, prefs.languagesConfirmed])

  useEffect(() => {
    if (gate !== 'product') return
    const timer = window.setInterval(() => void refreshSessionState(), 1000)
    const refreshOnFocus = () => void refreshPermissions()
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [gate, refreshSessionState])

  useEffect(() => {
    if (gate === 'product') {
      void window.kibotalk.onboarding.resize({ width: 1040, height: 720 })
      return
    }
    const root = document.getElementById('root')
    if (!root) return
    let lastKey = ''
    const report = () => {
      const rect = root.getBoundingClientRect()
      const size = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) }
      const key = `${size.width}x${size.height}`
      if (size.width < 1 || size.height < 1 || key === lastKey) return
      lastKey = key
      void window.kibotalk.onboarding.resize(size)
    }
    const observer = new ResizeObserver(report)
    observer.observe(root)
    report()
    return () => observer.disconnect()
  }, [gate])

  if (gate === 'booting' || systemLanguages === null || (gate === 'setup' && enrolled === null)) {
    return (
      <WizardScreen embedded className="text-center">
        <p className="text-sm text-muted-foreground">{t('preparing')}</p>
      </WizardScreen>
    )
  }

  if (gate === 'product') {
    if (view === 'history') {
      return (
        <HistoryPage
          storage={storage}
          embedded
          activeSessionId={activeSessionId}
          onBack={() => void window.kibotalk.onboarding.close()}
        />
      )
    }
    if (view === 'voiceprint') {
      return (
        <EnrollmentPage
          conversationLang={prefs.conversationLang}
          embedded
          requestMicrophone={window.kibotalk.permissions.requestMicrophone}
          onEnterSession={() => setView('settings')}
        />
      )
    }
    return (
      <SettingsPage
        platform="desktop"
        replyModelSettings={window.kibotalk.replyModel}
        systemTranscriptionLanguages={systemLanguages}
        embedded
        prefs={prefs}
        sessionActive={sessionActive}
        onPrefsChange={onPrefsChange}
        onBack={() => void window.kibotalk.onboarding.close()}
        onManageVoiceprint={() => setView('voiceprint')}
        onQuit={() => void window.kibotalk.app.requestQuit()}
        onLaunchAtLoginChange={(enabled) => window.kibotalk.app.setLaunchAtLogin(enabled)}
        microphonePermission={microphonePermission}
        screenPermission={screenPermission}
        onRequestMicrophonePermission={async () => {
          await window.kibotalk.permissions.requestMicrophone()
          await refreshPermissions()
        }}
        onRequestScreenPermission={async () => {
          await window.kibotalk.permissions.requestScreenRecording()
          await refreshPermissions()
        }}
      />
    )
  }

  return (
    <OnboardingPage
      embedded
      prefs={prefs}
      enrolled={!!enrolled}
      replyModel={desktopReplyModel}
      systemTranscriptionLanguages={systemLanguages}
      onDownloadProgress={window.kibotalk.onboarding.updateDownloadProgress}
      requestMicrophone={window.kibotalk.permissions.requestMicrophone}
      onPrefsChange={onPrefsChange}
      onComplete={() => {
        onPrefsChange({ ...prefs, languagesConfirmed: true })
        void window.kibotalk.onboarding.complete()
      }}
    />
  )
}

export default function OnboardingApp() {
  const [prefs, setPrefs] = useState<LanguagePrefs>(loadLanguagePrefs)

  function persist(next: LanguagePrefs) {
    setPrefs(next)
    persistLanguagePrefs(next)
  }

  return (
    <I18nProvider value={prefs} onChange={setPrefs}>
      <DesktopWindowContent prefs={prefs} onPrefsChange={persist} />
    </I18nProvider>
  )
}
