import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConversationSession, ConversationStorage } from '@kibotalk/conversation'
import { localizedSessionTitle, useI18n } from '@kibotalk/app-shared'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DesktopProductWindowFrame,
  ScrollArea,
  SessionListItem,
  StickyNoteCard,
} from '@kibotalk/ui'
import { ArrowLeftIcon, TrashBinTrashIcon } from '@kibotalk/ui/icons'

export type HistoryPageProps = {
  storage: ConversationStorage
  embedded?: boolean
  activeSessionId?: string
  onBack: () => void
}

function sessionSubtitle(session: ConversationSession, currentLabel: string): string {
  if (session.status !== 'stopped') return currentLabel
  const endedAt = session.endedAt ?? session.startedAt
  const durationMinutes = Math.max(
    1,
    Math.round((endedAt - session.startedAt - session.pausedDurationMs) / 60000),
  )
  return `${durationMinutes} min`
}

function HistoryTimeline({ session }: { session: ConversationSession }) {
  const { t } = useI18n()
  return (
    <ol className="space-y-5">
      {session.turns.map((turn) => {
        const user = turn.speaker === 'user'
        return (
          <li key={turn.id} className="space-y-3">
            <div className={`flex ${user ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[82%]">
                <div className={`mb-1 text-[10.5px] font-bold text-muted-foreground ${user ? 'text-right' : ''}`}>
                  {user ? t('me') : t('other')}
                </div>
                <div className={`rounded-md px-3.5 py-2.5 text-sm ${user ? 'bg-accent' : 'bg-foreground/5'}`}>
                  {turn.sttFailed ? t('sttFailed') : turn.text}
                </div>
              </div>
            </div>
            {turn.suggestions?.length ? (
              <div className="ml-4 border-l-2 border-accent pl-3 sm:ml-8 sm:pl-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('suggestions')}</p>
                <StickyNoteCard candidates={turn.suggestions} className="mx-0" />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function HistoryPage({
  storage,
  embedded = false,
  activeSessionId,
  onBack,
}: HistoryPageProps) {
  const { t } = useI18n()
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<'session' | 'history' | null>(null)

  const refresh = useCallback(async () => {
    const next = await storage.listSessions()
    setSessions(next)
    setSelectedId((current) => current ?? next[0]?.id ?? null)
  }, [storage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selected = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? null,
    [selectedId, sessions],
  )
  const windowClassName = 'min-h-dvh bg-background p-2 sm:p-5'
  const panelClassName = embedded
    ? 'grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden sm:grid-cols-[19rem_minmax(0,1fr)]'
    : 'paper-sheet mx-auto grid h-[calc(100dvh-1rem)] w-full max-w-6xl grid-cols-[minmax(0,1fr)] overflow-hidden sm:h-[calc(100dvh-2.5rem)] sm:grid-cols-[19rem_minmax(0,1fr)]'

  const page = (
    <>
      <div className={panelClassName}>
        <aside
          className={`min-h-0 min-w-0 border-border bg-muted/45 sm:flex sm:flex-col sm:border-r ${
            selected ? 'hidden sm:flex' : 'flex flex-col'
          }`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border p-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('back')}>
              <ArrowLeftIcon className="size-4" />
            </Button>
            <h1 className="text-base font-bold">{t('history')}</h1>
            {sessions.some((session) => session.status === 'stopped') ? (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDeleteTarget('history')}>
                {t('clearHistory')}
              </Button>
            ) : null}
          </div>
          <ScrollArea className="min-h-0 flex-1 p-2">
            {sessions.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center px-5 text-center text-sm text-muted-foreground">
                {t('noHistory')}
              </div>
            ) : (
              sessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  title={localizedSessionTitle(session)}
                  subtitle={sessionSubtitle(session, t('currentSession'))}
                  current={session.id === activeSessionId}
                  onClick={() => setSelectedId(session.id)}
                  className={session.id === selectedId ? 'bg-accent/75' : undefined}
                />
              ))
            )}
          </ScrollArea>
        </aside>

        <main className={`min-h-0 ${selected ? 'flex flex-col' : 'hidden sm:flex sm:flex-col'}`}>
          {selected ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-3 sm:px-5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  onClick={() => setSelectedId(null)}
                  aria-label={t('back')}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold">{localizedSessionTitle(selected)}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sessionSubtitle(selected, t('currentSession'))}
                  </p>
                </div>
                {selected.status === 'stopped' && selected.id !== activeSessionId ? (
                  <Button
                    variant="soft"
                    size="icon"
                    aria-label={t('deleteSession')}
                    onClick={() => setDeleteTarget('session')}
                  >
                    <TrashBinTrashIcon className="size-4" />
                  </Button>
                ) : null}
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <section className="mx-auto max-w-3xl p-4 lg:p-6">
                  <h3 className="mb-3 text-sm font-bold">{t('conversationHistory')}</h3>
                  <HistoryTimeline session={selected} />
                </section>
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {t('noHistory')}
            </div>
          )}
        </main>
      </div>
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(deleteTarget === 'history' ? 'clearHistory' : 'deleteSession')}</DialogTitle>
            <DialogDescription>
              {t(deleteTarget === 'history' ? 'clearHistoryDescription' : 'deleteSessionDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="soft">{t('cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteTarget === 'history') await storage.clearHistory()
                else if (deleteTarget === 'session' && selected) await storage.deleteSession(selected.id)
                else return
                setDeleteTarget(null)
                setSelectedId(null)
                await refresh()
              }}
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  return embedded ? (
    <DesktopProductWindowFrame heightMode="viewport">
      {page}
    </DesktopProductWindowFrame>
  ) : (
    <div className={windowClassName}>{page}</div>
  )
}
