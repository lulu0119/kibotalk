import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SessionAudioSource } from '@kibotalk/conversation'
import { useConversationSession } from '@kibotalk/app-shared'
import {
  Badge, Button, Card, Input, ResizableHandle, ResizablePanel, ResizablePanelGroup, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
  SheetTrigger, StickyNoteStack, ToggleGroup, ToggleGroupItem, cn,
} from '@kibotalk/ui'
import {
  EraserIcon,
  FileAudioIcon,
  ImportIcon,
  MicrophoneIcon,
  PauseIcon,
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
import { MediaControls, useMediaPlayback } from './components/MediaControls'
import { liveDraftSpeaker, trackLiveSpeakers, type LiveSpeakerLane } from './live-speaker-tracks'
import { startTrace, traceSource } from './io-tracer/trace'
import { playgroundReplyModel, playgroundVoiceprint } from './local-settings'
import { createFileAudio, createPlaybackTrace } from './file-audio'

const wideLayout = '(min-width: 64rem)'
function subscribeLayout(onChange: () => void) {
  const media = window.matchMedia(wideLayout)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const isWide = () => window.matchMedia(wideLayout).matches

type PlaygroundAudioSource = SessionAudioSource | 'file'
type InputMode = 'live' | 'file'
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
  const [inputMode, setInputMode] = useState<InputMode>('live')
  const [liveSource, setLiveSource] = useState<SessionAudioSource>('microphone')
  const [transcriptSource, setTranscriptSource] = useState<PlaygroundAudioSource>('microphone')
  const [verifiedSpeakers, setVerifiedSpeakers] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [stopping, setStopping] = useState(false)
  const [speakerLanes, setSpeakerLanes] = useState<LiveSpeakerLane[]>([])
  const speakerTracker = useRef<ReturnType<typeof trackLiveSpeakers>>(null)
  const sharedStream = useRef<MediaStream | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileAudio = useRef<ReturnType<typeof createFileAudio>>(null)
  const filePlaybackTrace = useRef<ReturnType<typeof createPlaybackTrace>>(null)
  const activeSource = useRef<PlaygroundAudioSource>('microphone')
  const fileRun = useRef(false)
  const beginning = useRef(false)
  const outputVolume = useRef(1)
  const playback = useMediaPlayback((value) => {
    outputVolume.current = value
    fileAudio.current?.volume(value)
  })
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
    allowUnenrolledMicrophone: true,
    previewSpeaker: false,
    getMicrophoneStream() {
      if (activeSource.current === 'file' && fileAudio.current) return fileAudio.current.stream()
    },
    async getSystemAudioStream() {
      const tracks = sharedStream.current?.getAudioTracks().filter((track) => track.readyState === 'live')
      if (!tracks?.length) throw new Error('共享音频已结束。')
      return new MediaStream(tracks)
    },
    stopSystemAudioStream: stopSharing,
    onAudioFrame: (source, frame, capturedAt) => {
      speakerTracker.current?.accept(source, frame, capturedAt)
      if (activeSource.current === 'file') filePlaybackTrace.current?.frame(frame)
    },
    trace: traceSource,
  })
  const { running, loading, state, vadStatus, modelDownloadPercent, error, confidence, start, stop, clearSession, turns, draft, candidateRounds } = session
  const starting = sharing || session.lifecycle === 'starting'
  const locked = running || starting || stopping
  const fileMode = inputMode === 'file'
  const transcriptUsesFile = transcriptSource === 'file'
  const playbackDisabled = starting || stopping
  const stopRef = useRef(stop)
  stopRef.current = stop
  useEffect(() => {
    useConfig.getState().setLiveSessionRunning(locked)
    if (!locked) speakerTracker.current?.finish()
  }, [locked])
  useEffect(() => {
    if (running || !fileRun.current) return
    fileRun.current = false
    playback.element.current?.pause()
    filePlaybackTrace.current?.pause()
  }, [running, playback.element])
  useEffect(() => {
    disposed.current = false
    return () => {
      disposed.current = true
      speakerTracker.current?.dispose()
      filePlaybackTrace.current?.pause()
      fileAudio.current?.dispose()
      fileAudio.current = null
      void stopRef.current()
      void stopSharing()
      useConfig.getState().setLiveSessionRunning(false)
    }
  }, [])

  async function startSession(source: PlaygroundAudioSource) {
    if (locked || beginning.current) return
    beginning.current = true
    try {
      await beginSession(source)
    } catch (cause) {
      setShareError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      beginning.current = false
    }
  }

  async function beginSession(source: PlaygroundAudioSource) {
    setShareError('')
    playback.pause()
    const usesFile = source === 'file'
    if (usesFile) {
      const element = playback.element.current
      if (!element) return
      fileAudio.current ??= createFileAudio(element)
      fileAudio.current.volume(outputVolume.current)
      void fileAudio.current.resume().catch(() => {})
    }
    if (source === 'system' || source === 'both') {
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
    const captureSource = usesFile ? 'microphone' : source
    activeSource.current = source
    setTranscriptSource(source)
    const verifySpeakers = captureSource === 'microphone' && hasEmbedding
    setVerifiedSpeakers(verifySpeakers)
    speakerTracker.current?.dispose()
    const enrollment = verifySpeakers ? { load: playgroundVoiceprint.load, threshold: speakerThreshold } : undefined
    speakerTracker.current = trackLiveSpeakers(captureSource, setSpeakerLanes, enrollment)
    startTrace()
    const started = await start({ audioSource: captureSource })
    if (started && usesFile && !disposed.current) {
      fileRun.current = true
      if (playback.element.current?.ended) playback.seek(0)
      await playFile()
    }
  }

  async function stopSession() {
    setStopping(true)
    fileRun.current = false
    playback.pause()
    filePlaybackTrace.current?.pause()
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

  function importAudio(file: File) {
    if (locked || beginning.current) return
    playback.load(file)
    filePlaybackTrace.current?.clear()
    void startSession('file')
  }

  async function playFile() {
    await playback.play()
    if (playback.element.current?.error && fileRun.current) await stopSession()
  }

  function toggleFilePlayback() {
    if (!running) {
      void startSession('file')
    } else if (playback.playing) {
      playback.pause()
    } else {
      void fileAudio.current?.resume().catch(() => {})
      void playFile()
    }
  }

  function tracePlaying(element: HTMLMediaElement) {
    if (!fileRun.current) return
    filePlaybackTrace.current ??= createPlaybackTrace()
    filePlaybackTrace.current.play(element)
  }

  const liveDraft = draft?.speaker === null ? { ...draft, speaker: liveDraftSpeaker(draft, speakerLanes) } : draft
  const transcript = (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex min-h-15 shrink-0 items-center gap-2 border-b px-4 py-2 sm:px-6">
        <h2 className="font-semibold">实时转写</h2>
      </div>
      <TranscriptPanel turns={turns} draft={liveDraft} source={transcriptSource === 'file' ? 'microphone' : transcriptSource} verifiedSpeakers={verifiedSpeakers} usesFile={transcriptUsesFile} />
      <LiveSpeakerTracks lanes={speakerLanes} usesFile={transcriptUsesFile} />
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
  const visibleError = shareError || (fileMode && playback.error)
    || (error === 'LLM_BROWSER_CONNECTION' ? '浏览器无法连接回复服务。如果服务限制跨域请求，请用 macOS 版。' : error)
  function fileActions(compact = false) {
    let playLabel = '播放文件'
    if (playback.playing) playLabel = '暂停播放'
    else if (running) playLabel = '继续播放'
    else if (playback.duration > 0 && playback.position >= playback.duration) playLabel = '重新播放'
    const stopLabel = starting ? '取消播放' : '结束播放'
    const size = compact ? 'icon' : 'default'
    const className = compact ? 'size-9' : undefined
    return (
      <>
        <Button size={size} className={className} aria-label={playLabel} title={compact ? playLabel : undefined} onClick={toggleFilePlayback} disabled={playbackDisabled}>
          {playback.playing ? <PauseIcon /> : <PlayIcon />}
          {!compact && playLabel}
        </Button>
        {locked && (
          <Button size={size} className={className} aria-label={stopLabel} title={compact ? stopLabel : undefined} variant="outline" onClick={() => void stopSession()} disabled={stopping}>
            <StopIcon />{!compact && stopLabel}
          </Button>
        )}
      </>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={inputMode} aria-label="声音源" disabled={locked} onValueChange={(value) => {
            if (!value) return
            setInputMode(value === 'file' ? 'file' : 'live')
            setShareError('')
          }}>
            <ToggleGroupItem value="live"><MicrophoneIcon aria-hidden="true" />实时录制</ToggleGroupItem>
            <ToggleGroupItem value="file"><FileAudioIcon aria-hidden="true" />音频文件</ToggleGroupItem>
          </ToggleGroup>
          {!fileMode && (
            <Select value={liveSource} onValueChange={(value) => setLiveSource(value as SessionAudioSource)} disabled={locked}>
              <SelectTrigger className="w-auto" aria-label="实时音频来源"><MicrophoneIcon /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="microphone">{sourceLabels.microphone}</SelectItem>
                <SelectItem value="system" disabled={!navigator.mediaDevices?.getDisplayMedia}>{sourceLabels.system}</SelectItem>
                <SelectItem value="both" disabled={!navigator.mediaDevices?.getDisplayMedia}>{sourceLabels.both}</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Input ref={fileInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.opus,.webm" className="hidden" aria-label="导入音频文件" onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) importAudio(file)
          }} />
          {fileMode ? (
            <>
              {playback.file ? fileActions() : (
                <Button disabled={locked} onClick={() => fileInput.current?.click()}><ImportIcon />选择并播放</Button>
              )}
              {playback.file && !locked && (
                <Button variant="outline" onClick={() => fileInput.current?.click()}><ImportIcon />更换文件</Button>
              )}
            </>
          ) : locked ? (
            <Button variant="destructive" onClick={() => void stopSession()} disabled={sharing || stopping}><StopIcon />停止录制</Button>
          ) : (
            <Button onClick={() => void startSession(liveSource)}>
              <MicrophoneIcon />开始录制
            </Button>
          )}
          {locked && <Badge variant={running ? 'default' : 'secondary'} role="status">
            {fileMode && running && !stopping ? (playback.playing ? '正在播放' : '已暂停') : status}
          </Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TraceDialog
            playback={fileMode && playback.file ? playback : undefined}
            playbackTrace={filePlaybackTrace}
            playbackDisabled={playbackDisabled}
            playbackTransport={fileMode && playback.file ? fileActions(true) : undefined}
          >
            <Button variant="outline"><PulseIcon />Trace</Button>
          </TraceDialog>
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
      {!fileMode && liveSource !== 'microphone' && !locked && (
        <p className="text-sm text-muted-foreground">选择要共享的来源，并打开「共享音频」。</p>
      )}
      <audio
        ref={(element) => { playback.element.current = element }}
        {...playback.mediaProps}
        onPlaying={(event) => tracePlaying(event.currentTarget)}
        onPause={() => { playback.mediaProps.onPause(); filePlaybackTrace.current?.pause() }}
        onWaiting={() => filePlaybackTrace.current?.pause()}
        onSeeking={() => filePlaybackTrace.current?.pause()}
        onSeeked={({ currentTarget }) => { if (!currentTarget.paused) tracePlaying(currentTarget) }}
        onRateChange={({ currentTarget }) => { if (!currentTarget.paused && !currentTarget.seeking) tracePlaying(currentTarget) }}
        onError={() => {
          playback.mediaProps.onError()
          if (fileRun.current) void stopSession()
        }}
        onEnded={() => {
          playback.mediaProps.onEnded()
          filePlaybackTrace.current?.pause()
          if (fileRun.current) void stopSession()
        }}
      />
      {fileMode && playback.file && (
        <Card className="min-w-0 shrink-0 px-3 py-2 sm:px-4">
          <MediaControls playback={playback} disabled={playbackDisabled} showFileName transport={null} />
        </Card>
      )}
      {visibleError && <p role="alert" className="text-sm text-destructive">{visibleError}</p>}
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
          <Card className="h-116 min-w-0 overflow-hidden">{transcript}</Card>
          <Card className="min-h-56 min-w-0 overflow-hidden">{suggestions}</Card>
        </div>
      )}
    </div>
  )
}
