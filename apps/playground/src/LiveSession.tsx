import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SessionAudioSource } from '@kibotalk/conversation'
import { useConversationSession } from '@kibotalk/app-shared'
import {
  Badge, Button, Card, ResizableHandle, ResizablePanel, ResizablePanelGroup, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
  SheetTrigger, StickyNoteStack, cn,
} from '@kibotalk/ui'
import {
  EraserIcon,
  LoaderIcon,
  MicrophoneIcon,
  PlayIcon,
  PulseIcon,
  StopIcon,
  Tuning2Icon,
} from '@kibotalk/ui/icons'
import { useConfig } from './config-store'
import { TranscriptPanel } from './components/TranscriptPanel'
import { DebugPanel } from './components/DebugPanel'
import { IslandBar } from './components/IslandBar'
import { ProductSurfaceToggle } from './components/ProductSurfaceToggle'
import { TraceDialog } from './components/TraceDialog'
import { LiveSpeakerTracks } from './components/LiveSpeakerTracks'
import { trackLiveSpeakers, type LiveSpeakerLane } from './live-speaker-tracks'
import { startTrace, traceSource } from './io-tracer/trace'
import { playgroundReplyModel, playgroundVoiceprint } from './local-settings'

const wideLayout = '(min-width: 64rem)'
function subscribeLayout(onChange: () => void) {
  const media = window.matchMedia(wideLayout)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const isWide = () => window.matchMedia(wideLayout).matches

const sourceLabels: Record<SessionAudioSource, string> = {
  microphone: '麦克风',
  system: '共享音频',
  both: '麦克风 + 共享音频',
}

export default function LiveSession({
  hasEmbedding,
  replyReady,
  onConfigureReply,
}: {
  hasEmbedding: boolean
  replyReady: boolean
  onConfigureReply: () => void
}) {
  const speechThreshold = useConfig((s) => s.speechThreshold)
  const minSilenceDurationMs = useConfig((s) => s.minSilenceDurationMs)
  const minSpeechDurationMs = useConfig((s) => s.minSpeechDurationMs)
  const pauseMs = useConfig((s) => s.pauseMs)
  const mergeMaxMs = useConfig((s) => s.mergeMaxMs)
  const speakerThreshold = useConfig((s) => s.speakerThreshold)
  const candidateRoundsMax = useConfig((s) => s.candidateRoundsMax)
  const islandSttEnabled = useConfig((s) => s.islandSttEnabled)
  const islandReplyEnabled = useConfig((s) => s.islandReplyEnabled)
  const floating = useConfig((s) => s.productSurfaceMode === 'floating')
  const patch = useConfig((s) => s.patch)
  const [audioSource, setAudioSource] = useState<SessionAudioSource>('microphone')
  const [transcriptSource, setTranscriptSource] = useState<SessionAudioSource>('microphone')
  const [verifiedSpeakers, setVerifiedSpeakers] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [stopping, setStopping] = useState(false)
  const [speakerLanes, setSpeakerLanes] = useState<LiveSpeakerLane[]>([])
  const speakerTracker = useRef<ReturnType<typeof trackLiveSpeakers>>(null)
  const sharedStream = useRef<MediaStream | null>(null)
  const disposed = useRef(false)
  const wide = useSyncExternalStore(subscribeLayout, isWide, () => false)
  const conversationLang = useConfig((s) => s.conversationLang)
  const meaningLang = useConfig((s) => s.uiLang)
  const level = useConfig((s) => s.level)
  const languageSnapshot = { conversationLang, meaningLang, level }
  const replyEnabled = islandReplyEnabled && replyReady

  async function stopSharing() {
    sharedStream.current?.getTracks().forEach((track) => track.stop())
    sharedStream.current = null
  }

  const session = useConversationSession({
    speechThreshold, minSilenceDurationMs, minSpeechDurationMs, pauseMs, mergeMaxMs, speakerThreshold,
    sttEnabled: islandSttEnabled,
    replyEnabled,
    languageSnapshot,
    replyStream: playgroundReplyModel.stream,
    speakerEmbeddingStorage: playgroundVoiceprint,
    sessionSnapshot: { ...languageSnapshot, uiLang: 'zh', audioSource, microphoneDeviceId: '' },
    allowUnenrolledMicrophone: true,
    async getSystemAudioStream() {
      const tracks = sharedStream.current?.getAudioTracks().filter((track) => track.readyState === 'live')
      if (!tracks?.length) throw new Error('共享音频已结束。')
      return new MediaStream(tracks)
    },
    stopSystemAudioStream: stopSharing,
    onAudioFrame: (source, frame) => speakerTracker.current?.accept(source, frame),
    trace: traceSource,
  })
  const { running, loading, state, vadStatus, modelDownloadPercent, error, confidence, start, stop, clearSession, turns, draft, candidateRounds } = session
  const starting = sharing || Boolean(loading)
  const locked = running || starting || stopping
  const stopRef = useRef(stop)
  stopRef.current = stop
  useEffect(() => {
    useConfig.getState().setLiveSessionRunning(locked)
    if (!locked) speakerTracker.current?.finish()
  }, [locked])
  useEffect(() => {
    disposed.current = false
    return () => {
      disposed.current = true
      speakerTracker.current?.dispose()
      void stopRef.current()
      void stopSharing()
      useConfig.getState().setLiveSessionRunning(false)
    }
  }, [])

  async function startSession() {
    setShareError('')
    if (audioSource !== 'microphone') {
      setSharing(true)
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        if (disposed.current || !stream.getAudioTracks().length) {
          stream.getTracks().forEach((track) => track.stop())
          if (!disposed.current) setShareError('共享时请选择带音频的来源，并打开「共享音频」。')
          return
        }
        sharedStream.current = stream
        for (const track of stream.getTracks()) {
          track.addEventListener('ended', () => {
            if (sharedStream.current !== stream) return
            void stopSession()
          }, { once: true })
        }
      } catch (cause) {
        if (!disposed.current) {
          setShareError(cause instanceof DOMException && cause.name === 'NotAllowedError'
            ? '未授予共享权限。可重试或改用麦克风。' : '无法共享音频，请切换到麦克风或使用支持共享音频的浏览器。')
        }
        return
      } finally {
        if (!disposed.current) setSharing(false)
      }
    }
    setTranscriptSource(audioSource)
    setVerifiedSpeakers(audioSource === 'microphone' && hasEmbedding)
    speakerTracker.current?.dispose()
    speakerTracker.current = trackLiveSpeakers(audioSource, setSpeakerLanes)
    startTrace()
    await start()
  }

  async function stopSession() {
    setStopping(true)
    speakerTracker.current?.finish()
    try {
      await stop()
    } catch (cause) {
      setShareError(String(cause))
    } finally {
      await stopSharing()
      setStopping(false)
    }
  }

  async function clear() {
    speakerTracker.current?.dispose()
    speakerTracker.current = null
    setSpeakerLanes([])
    await clearSession()
  }

  const transcript = (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex items-center min-h-15 gap-2 border-b px-4 py-2 sm:px-6">
        <h2 className="font-semibold">实时转写</h2>
      </div>
      <TranscriptPanel turns={turns} draft={draft} source={transcriptSource} verifiedSpeakers={verifiedSpeakers} />
    </section>
  )
  const suggestions = (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between min-h-15 gap-2 border-b px-4 py-2 sm:px-6">
        <h2 className="font-semibold">回复建议</h2>
        <ProductSurfaceToggle />
      </div>
      <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-auto px-4 py-4 sm:px-6", floating && 'floating-sim island-stage pb-20')}>
        {candidateRounds.length > 0 || (state === 'LLM_STREAMING' && replyEnabled) ? (
          <StickyNoteStack rounds={candidateRounds} maxRounds={candidateRoundsMax} streaming={state === 'LLM_STREAMING' && replyEnabled} />
        ) : !replyReady ? (
          <div className="flex justify-center py-8">
            <Button size="sm" variant="outline" onClick={onConfigureReply}>配置回复模型</Button>
          </div>
        ) : !replyEnabled ? (
          <p className="py-8 text-center text-sm text-muted-foreground">回复建议已暂停。</p>
        ) : null}
        {floating && (
          <IslandBar
            state={state}
            vadStatus={vadStatus}
            sttEnabled={islandSttEnabled}
            replyEnabled={replyEnabled}
            onToggleStt={() => patch({ islandSttEnabled: !islandSttEnabled })}
            onToggleReply={replyReady ? () => patch({ islandReplyEnabled: !islandReplyEnabled }) : onConfigureReply}
          />
        )}
      </div>
    </section>
  )
  const transcriptionStatus = modelDownloadPercent !== undefined && modelDownloadPercent < 100
    ? `正在下载 · ${modelDownloadPercent}%`
    : '正在准备转写'
  const status = stopping ? '正在结束' : sharing ? '等待共享权限' : loading ? transcriptionStatus : (
    state === 'LLM_STREAMING' ? '正在生成回复' : vadStatus === 'speech' ? '听写中' : '正在监听'
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={audioSource} onValueChange={(value) => setAudioSource(value as SessionAudioSource)} disabled={locked}>
            <SelectTrigger className="w-auto" aria-label="音频来源"><MicrophoneIcon /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="microphone">{sourceLabels.microphone}</SelectItem>
              <SelectItem value="system" disabled={!navigator.mediaDevices?.getDisplayMedia}>{sourceLabels.system}</SelectItem>
              <SelectItem value="both" disabled={!navigator.mediaDevices?.getDisplayMedia}>{sourceLabels.both}</SelectItem>
            </SelectContent>
          </Select>
          {running || loading ? (
            <Button variant="destructive" onClick={() => void stopSession()} disabled={stopping}><StopIcon />停止会话</Button>
          ) : (
            <Button onClick={() => void startSession()} disabled={starting || stopping}>
              {starting ? <LoaderIcon className="animate-spin" /> : <PlayIcon />}开始会话
            </Button>
          )}
          {locked && <Badge variant={running ? 'default' : 'secondary'} role="status">{status}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TraceDialog><Button variant="outline"><PulseIcon />Trace</Button></TraceDialog>
          <Sheet>
            <SheetTrigger asChild><Button variant="outline" size="icon" aria-label="管线参数"><Tuning2Icon /></Button></SheetTrigger>
            <SheetContent className="w-full overflow-auto sm:max-w-md">
              <SheetHeader><SheetTitle>管线参数</SheetTitle><SheetDescription>调整语音活动检测、声纹和话轮合并。</SheetDescription></SheetHeader>
              <div className="mt-4"><DebugPanel running={locked} confidence={confidence} /></div>
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="icon" aria-label="清空会话" disabled={locked || (!turns.length && !speakerLanes.length)} onClick={() => void clear()}><EraserIcon /></Button>
        </div>
      </div>
      {audioSource !== 'microphone' && !locked && (
        <p className="text-sm text-muted-foreground">选择要共享的来源，并打开「共享音频」。</p>
      )}
      {(shareError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {shareError || (error === 'LLM_BROWSER_CONNECTION' ? '浏览器无法连接回复服务。如果服务限制跨域请求，请用 macOS 版。' : error)}
        </p>
      )}
      {speakerLanes.length > 0 && <LiveSpeakerTracks lanes={speakerLanes} />}
      {wide ? (
        <Card className="flex min-h-96 min-w-0 flex-1 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" className="h-auto min-h-0 flex-1">
            <ResizablePanel id="transcript" defaultSize="56%" minSize="33%">{transcript}</ResizablePanel>
            <ResizableHandle withHandle aria-label="调整转写与回复建议的宽度" />
            <ResizablePanel id="suggestions" defaultSize="44%" minSize="30%">{suggestions}</ResizablePanel>
          </ResizablePanelGroup>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-4">
          <Card className="h-80 min-w-0 overflow-hidden">{transcript}</Card>
          <Card className="min-h-56 min-w-0 overflow-hidden">{suggestions}</Card>
        </div>
      )}
    </div>
  )
}
