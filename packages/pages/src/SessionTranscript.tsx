import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SessionDraft, SessionTurn } from '@kibotalk/app-shared'
import { useI18n } from '@kibotalk/app-shared'
import { Button, ScrollArea, cn } from '@kibotalk/ui'
import { AltArrowDownIcon } from '@kibotalk/ui/icons'

export function SessionTranscript({ id, turns, draft, visible }: {
  id: string
  turns: SessionTurn[]
  draft: SessionDraft | null
  visible: boolean
}) {
  const { t, language } = useI18n()
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const latestScrollTop = useRef<number | null>(null)
  const [followingLatest, setFollowingLatest] = useState(true)
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
  }), [language])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content || !followingLatest) return
    const scrollToLatest = () => {
      if (viewport.clientHeight === 0) return
      viewport.scrollTop = viewport.scrollHeight
      latestScrollTop.current = viewport.scrollTop
    }
    scrollToLatest()
    const observer = new ResizeObserver(scrollToLatest)
    observer.observe(viewport)
    observer.observe(content)
    return () => observer.disconnect()
  }, [followingLatest])

  return (
    <aside
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
        visible ? 'flex' : 'hidden sm:flex',
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 id={`${id}-title`} className="truncate text-sm font-semibold">{t('conversationHistory')}</h2>
        {!followingLatest ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('jumpToLatestTranscript')}
            title={t('jumpToLatestTranscript')}
            onClick={() => setFollowingLatest(true)}
          >
            <AltArrowDownIcon />
          </Button>
        ) : null}
      </header>
      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={viewportRef}
        viewportClassName="overscroll-contain [overflow-anchor:none] [&>div]:block!"
        onScrollCapture={(event) => {
          const viewport = viewportRef.current
          if (event.target !== viewport || viewport.clientHeight === 0) return
          if (viewport.scrollTop === latestScrollTop.current) return
          latestScrollTop.current = null
          setFollowingLatest(viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 48)
        }}
      >
        <div ref={contentRef}>
          {turns.length > 0 || draft ? (
            <ol className="space-y-4 px-4 py-4">
              {turns.map((turn) => (
                <li key={turn.id} className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold">{t(turn.speaker === 'user' ? 'me' : 'other')}</span>
                    <time dateTime={new Date(turn.startedAt).toISOString()}>{timeFormat.format(turn.startedAt)}</time>
                  </div>
                  <p className={cn(
                    'w-fit max-w-full whitespace-pre-wrap wrap-anywhere rounded-md px-3 py-2 text-sm leading-relaxed',
                    turn.speaker === 'user' ? 'bg-accent' : 'bg-muted',
                  )}>
                    {turn.sttFailed ? t('sttFailed') : turn.text}
                  </p>
                </li>
              ))}
              {draft ? (
                <li className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {draft.speaker && <span className="font-semibold">{t(draft.speaker === 'user' ? 'me' : 'other')}</span>}
                    <span>{t('listening')}</span>
                  </div>
                  <p className="w-fit max-w-full whitespace-pre-wrap wrap-anywhere rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm leading-relaxed">
                    {draft.text || '…'}
                  </p>
                </li>
              ) : null}
            </ol>
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t('noTranscript')}</p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
