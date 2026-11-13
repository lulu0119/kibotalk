import { useEffect, useRef, useState } from 'react'
import type { ProductSessionController } from '@kibotalk/app-shared'
import { useI18n } from '@kibotalk/app-shared'
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IslandBar,
  IslandDragHandle,
  IslandNavButton,
  IslandSeparator,
  IslandStatus,
  IslandToggleButton,
  StickyNoteStack,
} from '@kibotalk/ui'
import {
  EyeOffDuotoneIcon,
  HistoryDuotoneIcon,
  LogoutDuotoneIcon,
  MenuDotsDuotoneIcon,
  PauseDuotoneIcon,
  PlayDuotoneIcon,
  SettingsDuotoneIcon,
  SparklesDuotoneIcon,
  StopDuotoneIcon,
} from '@kibotalk/ui/icons'
import { IslandShell } from './IslandShell'

export type IslandPageProps = {
  controller: ProductSessionController
  contentSide: 'above' | 'below'
  onGoSettings?: () => void
  onGoHistory?: () => void
  onHide?: () => void
  onQuit?: () => void
}

const islandMenuItemClass = 'min-h-8 gap-2 px-2 py-1 focus:bg-white/10 focus:text-stone-100 [&_svg]:size-4.5'

function useVisibleRoundCount() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(1)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => {
      const height = root.getBoundingClientRect().height
      setCount(height >= 820 ? 3 : height >= 620 ? 2 : 1)
    }
    const observer = new ResizeObserver(update)
    observer.observe(root)
    update()
    return () => observer.disconnect()
  }, [])
  return { rootRef, count }
}

function islandStatus(controller: ProductSessionController, translate: ReturnType<typeof useI18n>['t']) {
  const { lifecycle, state, vadStatus, loading } = controller.session
  if (loading) return { label: loading, pulse: true, toneClassName: 'bg-white/60' }
  if (lifecycle === 'paused') return { label: translate('paused') }
  if (lifecycle === 'stopped') return { label: translate('stopped') }
  if (state === 'LLM_STREAMING') {
    return { label: translate('generatingSuggestions'), pulse: true, toneClassName: 'bg-white/70' }
  }
  return { label: translate('listening'), pulse: vadStatus === 'speech', toneClassName: 'bg-primary-soft-strong' }
}

function sessionToggle(controller: ProductSessionController, translate: ReturnType<typeof useI18n>['t']) {
  const { session } = controller
  const { lifecycle } = session
  switch (lifecycle) {
    case 'running':
      return { label: translate('pause'), onClick: () => void session.pause() }
    case 'paused':
      return { label: translate('resume'), onClick: () => void session.resume() }
    case 'restoring':
    case 'starting':
    case 'stopped':
      return {
        label: translate('start'),
        onClick: controller.requestSessionStart,
        disabled: lifecycle !== 'stopped',
      }
    default:
      throw new Error(`Unsupported session lifecycle: ${lifecycle satisfies never}`)
  }
}

/** Production desktop floating window, including live resize-aware round count and vertical flip. */
export function IslandPage({
  controller,
  contentSide,
  onGoSettings,
  onGoHistory,
  onHide,
  onQuit,
}: IslandPageProps) {
  const { t } = useI18n()
  const { rootRef, count } = useVisibleRoundCount()
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [quitDialogOpen, setQuitDialogOpen] = useState(false)
  const { session, rounds, replyEnabled, setReplyEnabled } = controller
  const tone = islandStatus(controller, t)
  const running = session.lifecycle === 'running'
  const active = running || session.lifecycle === 'paused'
  const latestTurn = session.turns.at(-1)
  const transcript = session.draft ?? latestTurn
  const showSuggestions = rounds.length > 0 || session.state === 'LLM_STREAMING'

  let sessionError = session.error
  if (sessionError === 'LLM_SETTINGS_REQUIRED') sessionError = t('replyModelRequired')
  if (sessionError === 'VOICEPRINT_REQUIRED') sessionError = t('voiceprintRequired')
  if (sessionError === 'SYSTEM_TRANSCRIPTION_UNAVAILABLE') sessionError = t('systemTranscriptionUnavailable')
  const content = sessionError || transcript || showSuggestions ? (
    <div className="desktop-float-content desktop-interactive flex min-h-0 w-full flex-1 flex-col gap-2.5">
      {sessionError ? (
        <div role="alert" className="glass-chip shrink-0 px-3.5 py-2 text-xs">
          {sessionError}
        </div>
      ) : null}
      {transcript ? (
        <div className="glass-chip shrink-0 px-3.5 py-2 text-xs" aria-live="polite">
          <strong className="mr-2 text-[10px] text-island-foreground/50">
            {t(transcript.speaker === null ? 'listening' : transcript.speaker === 'user' ? 'me' : 'other')}
          </strong>
          {'sttFailed' in transcript && transcript.sttFailed ? t('sttFailed') : transcript.text || '…'}
        </div>
      ) : null}
      {showSuggestions ? (
        <StickyNoteStack
          className="min-h-0 flex-1 overflow-hidden"
          rounds={rounds}
          maxRounds={count}
          streaming={session.state === 'LLM_STREAMING'}
          generatingLabel={t('generatingSuggestions')}
          previousRoundLabel={t('previousRound')}
          compactOlderRounds
          scrollable={false}
        />
      ) : null}
    </div>
  ) : null

  const island = (
    <IslandBar className="desktop-interactive mx-auto shrink-0">
      <IslandStatus {...tone} />
      <IslandSeparator />
      <IslandToggleButton {...sessionToggle(controller, t)} on={running}>
        {running ? <PauseDuotoneIcon /> : <PlayDuotoneIcon />}
      </IslandToggleButton>
      <IslandNavButton
        label={t('stopAndSave')}
        disabled={!active}
        onClick={() => setStopDialogOpen(true)}
      >
        <StopDuotoneIcon />
      </IslandNavButton>
      <IslandToggleButton
        on={replyEnabled}
        label={t('aiSuggestions')}
        onClick={() => setReplyEnabled((enabled) => !enabled)}
      >
        <SparklesDuotoneIcon />
      </IslandToggleButton>
      <IslandSeparator />
      <IslandDragHandle label={t('moveWindow')} />
      <DropdownMenu>
        <IslandNavButton asChild label={t('more')}>
          <DropdownMenuTrigger>
            <MenuDotsDuotoneIcon />
          </DropdownMenuTrigger>
        </IslandNavButton>
        <DropdownMenuContent
          className="island-menu min-w-0 rounded-xl border-white/10 bg-island p-2 text-stone-200"
          align="end"
          side={contentSide === 'above' ? 'top' : 'bottom'}
          sideOffset={8}
          collisionPadding={12}
          avoidCollisions={false}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {onGoHistory ? (
            <DropdownMenuItem className={islandMenuItemClass} onSelect={onGoHistory}>
              <HistoryDuotoneIcon />
              {t('history')}
            </DropdownMenuItem>
          ) : null}
          {onGoSettings ? (
            <DropdownMenuItem className={islandMenuItemClass} onSelect={onGoSettings}>
              <SettingsDuotoneIcon />
              {t('settings')}
            </DropdownMenuItem>
          ) : null}
          {onHide ? (
            <DropdownMenuItem className={islandMenuItemClass} onSelect={onHide}>
              <EyeOffDuotoneIcon />
              {t('hideWindow')}
            </DropdownMenuItem>
          ) : null}
          {onQuit ? (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className={islandMenuItemClass} onSelect={() => setQuitDialogOpen(true)}>
                <LogoutDuotoneIcon />
                {t('quit')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </IslandBar>
  )

  return (
    <>
      <IslandShell
        rootRef={rootRef}
        contentSide={contentSide}
        content={content}
        island={island}
      />

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

      <Dialog open={quitDialogOpen} onOpenChange={setQuitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active ? t('quitTitleActive') : t('quitTitleStopped')}</DialogTitle>
            <DialogDescription>
              {active ? t('quitDescriptionActive') : t('quitDescriptionStopped')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="soft">{t('cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                if (active) await session.stop()
                onQuit?.()
              }}
            >
              {t('quit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
