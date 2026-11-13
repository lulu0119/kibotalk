import { useEffect, useState } from 'react'
import type { ConversationStorage } from '@kibotalk/conversation'
import {
  createCurrentSpeakerEmbeddingStorage,
  createLocalConversationStorage,
  createSessionSnapshot,
  I18nProvider,
  loadLanguagePrefs,
  persistLanguagePrefs,
  useI18n,
  useProductSession,
  type LanguagePrefs,
} from '@kibotalk/app-shared'
import {
  EnrollmentPage,
  HistoryPage,
  OnboardingPage,
  SessionPage,
  SettingsPage,
} from '@kibotalk/pages'
import { Button } from '@kibotalk/ui'

type ProductView = 'session' | 'settings' | 'history' | 'voiceprint'

function WebProductShell({
  prefs,
  storage,
  onPrefsChange,
}: {
  prefs: LanguagePrefs
  storage: ConversationStorage
  onPrefsChange: (prefs: LanguagePrefs) => void
}) {
  const [view, setView] = useState<ProductView>('session')
  const [microphonePermission, setMicrophonePermission] =
    useState<'granted' | 'not-determined' | 'denied' | 'unknown'>('unknown')
  const snapshot = createSessionSnapshot(prefs)
  const controller = useProductSession({
    languageSnapshot: snapshot,
    sessionSnapshot: snapshot,
    storage,
  })

  useEffect(() => {
    let cancelled = false
    const permissions = navigator.permissions
    if (!permissions?.query) return
    void permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (cancelled) return
        setMicrophonePermission(status.state === 'prompt' ? 'not-determined' : status.state)
        status.onchange = () => {
          setMicrophonePermission(status.state === 'prompt' ? 'not-determined' : status.state)
        }
      })
      .catch(() => {
        if (!cancelled) setMicrophonePermission('unknown')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (view === 'settings') {
    return (
      <SettingsPage
        platform="web"
        prefs={prefs}
        sessionActive={controller.session.lifecycle !== 'stopped'}
        onPrefsChange={onPrefsChange}
        onBack={() => setView('session')}
        onManageVoiceprint={() => setView('voiceprint')}
        microphonePermission={microphonePermission}
        onRequestMicrophonePermission={async () => {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach((track) => track.stop())
          setMicrophonePermission('granted')
        }}
      />
    )
  }

  if (view === 'history') {
    return (
      <HistoryPage
        storage={storage}
        activeSessionId={controller.session.activeSession?.id}
        onBack={() => setView('session')}
      />
    )
  }

  if (view === 'voiceprint') {
    return (
      <EnrollmentPage
        conversationLang={prefs.conversationLang}
        onEnterSession={() => setView('settings')}
      />
    )
  }

  return (
    <SessionPage
      controller={controller}
      onGoSettings={() => setView('settings')}
      onGoHistory={() => setView('history')}
    />
  )
}

function AppContent({
  prefs,
  onPrefsChange,
}: {
  prefs: LanguagePrefs
  onPrefsChange: (prefs: LanguagePrefs) => void
}) {
  const [enrolled, setEnrolled] = useState<boolean | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const { t } = useI18n()
  const [storage] = useState(createLocalConversationStorage)

  useEffect(() => {
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
  }, [])

  if (enrolled === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p role="status" className="text-sm text-muted-foreground">{t('preparing')}</p>
      </div>
    )
  }

  if (showHistory) return <HistoryPage storage={storage} onBack={() => setShowHistory(false)} />

  if (!enrolled || !prefs.languagesConfirmed) {
    return (
      <>
        <OnboardingPage
          prefs={prefs}
          enrolled={enrolled}
          onPrefsChange={onPrefsChange}
          onComplete={() => {
            onPrefsChange({ ...prefs, languagesConfirmed: true })
            setEnrolled(true)
          }}
        />
        {prefs.languagesConfirmed ? (
          <div className="fixed bottom-4 right-4">
            <Button variant="outline" onClick={() => setShowHistory(true)}>{t('history')}</Button>
          </div>
        ) : null}
      </>
    )
  }

  return <WebProductShell prefs={prefs} storage={storage} onPrefsChange={onPrefsChange} />
}

export default function App() {
  const [prefs, setPrefs] = useState<LanguagePrefs>(loadLanguagePrefs)

  function persist(next: LanguagePrefs) {
    setPrefs(next)
    persistLanguagePrefs(next)
  }

  return (
    <I18nProvider value={prefs} onChange={setPrefs}>
      <AppContent prefs={prefs} onPrefsChange={persist} />
    </I18nProvider>
  )
}
