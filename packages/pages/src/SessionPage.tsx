import { useEffect, useId, useState } from 'react'
import type { ProductSessionController } from '@kibotalk/app-shared'
import { languageLabel, shouldShowSessionError, useI18n } from '@kibotalk/app-shared'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  StickyNoteStack,
  Switch,
  cn,
} from '@kibotalk/ui'
import {
  HistoryIcon,
  MenuDotsIcon,
  PanelLeftIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  SparklesIcon,
  StopIcon,
} from '@kibotalk/ui/icons'
import { SessionTranscript } from './SessionTranscript'

export type SessionPageProps = {
  controller: ProductSessionController
  onGoSettings?: () => void
  onGoHistory?: () => void
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function useSessionDuration({ activeSession, lifecycle }: ProductSessionController['session']): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (lifecycle !== 'running') return
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [lifecycle])
  if (!activeSession) return 0
  const end = activeSession.endedAt ?? (lifecycle === 'paused' ? activeSession.pausedAt ?? now : now)
  return end - activeSession.startedAt - activeSession.pausedDurationMs
}

function SessionToolbar({
  controller,
  onGoHistory,
  onGoSettings,
  onStop,
}: SessionPageProps & { onStop: () => void }) {
  const { t, language, prefs } = useI18n()
  const { session, replyEnabled, setReplyEnabled } = controller
  const { activeSession, lifecycle, loading } = session
  const duration = useSessionDuration(session)
  const running = lifecycle === 'running'
  const paused = lifecycle === 'paused'
  const active = running || paused
  const busy = lifecycle === 'starting' || lifecycle === 'restoring'
  const conversationLanguage = activeSession?.snapshot.conversationLang ?? prefs.conversationLang
  let status = t('listening')
  if (paused) status = t('paused')
  if (lifecycle === 'stopped') status = t('stopped')
  if (busy) status = t('preparing')

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5 sm:gap-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 shrink-0 rounded-full',
            running && 'bg-emerald-500',
            paused && 'bg-primary',
            !active && 'bg-foreground/25',
          )}
        />
        <div className="min-w-0">
          <div role="status" className="truncate text-sm font-semibold">{status}</div>
          <div className="truncate text-xs tabular-nums text-muted-foreground">
            {languageLabel(conversationLanguage, language)}
            {activeSession ? ` · ${formatDuration(duration)}` : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {active ? (
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label={t(running ? 'pause' : 'resume')}
              title={t(running ? 'pause' : 'resume')}
              onClick={() => running ? void session.pause() : void session.resume()}
            >
              {running ? <PauseIcon /> : <PlayIcon />}
            </Button>
            <Button variant="outline" aria-label={t('stop')} title={t('stop')} onClick={onStop} className="px-2.5 sm:px-4">
              <StopIcon />
              <span className="hidden sm:inline">{t('stop')}</span>
            </Button>
          </>
        ) : (
          <Button disabled={busy} aria-label={t('start')} title={loading || undefined} onClick={controller.requestSessionStart} className="px-2.5 sm:px-4">
            <PlayIcon />
            <span className="hidden min-[360px]:inline">{t('start')}</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('more')}>
              <MenuDotsIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              className="sm:hidden"
              checked={replyEnabled}
              onCheckedChange={setReplyEnabled}
            >
              {t('aiSuggestions')}
            </DropdownMenuCheckboxItem>
            {onGoHistory ? (
              <DropdownMenuItem onSelect={onGoHistory}>
                <HistoryIcon />
                {t('history')}
              </DropdownMenuItem>
            ) : null}
            {onGoSettings ? (
              <DropdownMenuItem onSelect={onGoSettings}>
                <SettingsIcon />
                {t('settings')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function sessionErrorMessage(session: ProductSessionController['session'], t: ReturnType<typeof useI18n>['t']) {
  if (!shouldShowSessionError(session.lifecycle, session.error)) return ''
  switch (session.error) {
    case 'VOICEPRINT_REQUIRED': return t('voiceprintRequired')
    case 'LLM_SETTINGS_REQUIRED': return t('replyModelRequired')
    case 'LLM_BROWSER_CONNECTION': return t('replyModelBrowserError')
    default: return session.error
  }
}

export function SessionPage({ controller, onGoSettings, onGoHistory }: SessionPageProps) {
  const { t } = useI18n()
  const transcriptId = useId()
  const [showTranscript, setShowTranscript] = useState(false)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const { session, rounds, replyEnabled, setReplyEnabled } = controller
  const streaming = replyEnabled && session.state === 'LLM_STREAMING'
  const sessionError = sessionErrorMessage(session, t)
  const ready = session.lifecycle === 'stopped' && rounds.length === 0
  let emptyHint = t('emptySuggestions')
  if (!replyEnabled) emptyHint = t('suggestionsPaused')
  else if (ready) emptyHint = t('emptySuggestionsBeforeSession')

  return (
    <div className="session-workbench mx-auto flex h-dvh w-full max-w-7xl flex-col overflow-hidden">
      <SessionToolbar
        controller={controller}
        onGoHistory={onGoHistory}
        onGoSettings={onGoSettings}
        onStop={() => setStopDialogOpen(true)}
      />

      {session.loading || sessionError || session.recoveredUnexpectedPause ? (
        <div className="shrink-0 space-y-1 border-b border-border bg-card px-3 py-2 text-xs sm:px-5">
          {session.loading ? <p role="status" className="text-muted-foreground">{session.loading}</p> : null}
          {sessionError ? <p role="alert" className="text-destructive wrap-anywhere">{sessionError}</p> : null}
          {session.recoveredUnexpectedPause ? <p role="status" className="text-muted-foreground">{t('activeSessionRecovered')}</p> : null}
        </div>
      ) : null}

      <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-border bg-card px-3 py-2 sm:hidden">
        <Button
          variant={showTranscript ? 'ghost' : 'secondary'}
          size="sm"
          aria-pressed={!showTranscript}
          onClick={() => setShowTranscript(false)}
        >
          <SparklesIcon />
          {t('suggestions')}
        </Button>
        <Button
          variant={showTranscript ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={showTranscript}
          aria-controls={transcriptId}
          onClick={() => setShowTranscript(true)}
        >
          <PanelLeftIcon />
          {t('conversationHistory')}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[minmax(0,3fr)_minmax(14rem,2fr)] sm:gap-4 sm:p-4 md:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)] lg:gap-5 lg:p-5">
        <main className={cn(
          'web-suggestion-stage min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
          showTranscript ? 'hidden sm:flex' : 'flex',
        )}>
          <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <h1 className="truncate text-base font-semibold">{t('suggestions')}</h1>
            <div className="flex shrink-0 items-center gap-2">
              {streaming && rounds.length > 0 ? (
                <span role="status" className="text-xs text-muted-foreground">{t('generatingSuggestions')}</span>
              ) : null}
              <Switch
                className="hidden sm:inline-flex"
                checked={replyEnabled}
                onCheckedChange={setReplyEnabled}
                aria-label={t('aiSuggestions')}
                title={t('aiSuggestions')}
              />
            </div>
          </header>
          <StickyNoteStack
            className="min-h-0 flex-1"
            rounds={rounds}
            maxRounds={3}
            streaming={streaming}
            emptyHint={emptyHint}
            generatingLabel={t('generatingSuggestions')}
            previousRoundLabel={t('previousRound')}
          />
        </main>
        <SessionTranscript
          key={session.activeSession?.id}
          id={transcriptId}
          turns={session.turns}
          draft={session.draft}
          visible={showTranscript}
        />
      </div>

      <Dialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stopTitle')}</DialogTitle>
            <DialogDescription>{t('stopDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="soft">{t('cancel')}</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setStopDialogOpen(false)
                void session.stop()
              }}
            >
              {t('stopAndSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
