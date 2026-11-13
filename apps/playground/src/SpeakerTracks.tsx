import { useEffect, useId, useRef, useState } from 'react'
import type { SpeakerSegment } from '@sherpaw/speaker-diarization'
import { ImportIcon, LoaderIcon, MicrophoneIcon, SoundwaveIcon, StopIcon } from '@kibotalk/ui/icons'
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn,
} from '@kibotalk/ui'
import { MediaControls, useMediaPlayback } from './components/MediaControls'
import { groupSpeakerSegments, speakerColor, speakerName, SpeakerTrackRows } from './components/SpeakerTrackRows'
import { analyzeSpeakers } from './speaker-diarization'
import { useMicrophoneRecording } from './use-microphone-recording'

export default function SpeakerTracks() {
  const fileInput = useRef<HTMLInputElement>(null)
  const pending = useRef<AbortController | null>(null)
  const playback = useMediaPlayback()
  const { file, url, duration, position } = playback
  const [speakerCount, setSpeakerCount] = useState('auto')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ duration: number; segments: SpeakerSegment[] }>()
  const countId = useId()
  const recording = useMicrophoneRecording((recorded) => {
    selectFile(recorded)
    void analyze(recorded)
  }, setError)
  useEffect(() => () => pending.current?.abort(), [])

  function cancel() {
    pending.current?.abort()
    pending.current = null
    setStatus('')
  }

  function selectFile(nextFile: File) {
    cancel()
    setResult(undefined)
    setError('')
    playback.load(nextFile)
  }

  async function analyze(input: File) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setError('')
    setResult(undefined)
    try {
      const count = speakerCount === 'auto' ? undefined : Number(speakerCount)
      const next = await analyzeSpeakers(input, count, controller.signal, (message) => {
        if (!controller.signal.aborted) setStatus(message)
      })
      if (!controller.signal.aborted) setResult(next)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (pending.current === controller) cancel()
    }
  }

  const segments = result?.segments ?? []
  const tracks = groupSpeakerSegments(segments)
  const isActive = ({ start, end }: SpeakerSegment) => start <= position + 0.01 && end > position
  const activeSpeakers = new Set(segments.filter(isActive).map(({ speaker }) => speaker))
  const totalTime = Math.max(duration, result?.duration ?? 0)
  const isVideo = !!file && (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SoundwaveIcon className="size-4" />说话人分轨</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <Input
          ref={fileInput}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          aria-label="导入音频或视频文件"
          onChange={(event) => {
            const nextFile = event.target.files?.[0]
            if (nextFile) selectFile(nextFile)
            event.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" disabled={!!recording.state} onClick={() => fileInput.current?.click()}><ImportIcon />导入音频或视频</Button>
          {recording.state === 'recording' ? (
            <Button variant="destructive" onClick={recording.stop}><StopIcon />结束录音</Button>
          ) : (
            <Button variant="outline" disabled={!!status || recording.state === 'requesting'} onClick={() => {
              playback.pause()
              setError('')
              void recording.start()
            }}>
              <MicrophoneIcon />{recording.state === 'requesting' ? '正在打开麦克风…' : '开始录音'}
            </Button>
          )}
          {file && (
            <>
              <div className="space-y-2">
                <Label htmlFor={countId}>说话人数</Label>
                <Select value={speakerCount} onValueChange={setSpeakerCount} disabled={!!status || !!recording.state}>
                  <SelectTrigger id={countId} className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动识别</SelectItem>
                    {[1, 2, 3, 4, 5, 6].map((count) => <SelectItem key={count} value={String(count)}>{count} 人</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {status ? (
                <Button variant="outline" onClick={cancel}>取消分析</Button>
              ) : (
                <Button disabled={!!recording.state} onClick={() => void analyze(file)}>{result ? '重新分析' : '分析声纹'}</Button>
              )}
            </>
          )}
        </div>
        {file && <p className="text-sm text-muted-foreground wrap-break-word">{file.name}</p>}
        {status && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderIcon className="size-4 animate-spin" />{status}</p>}
        {(error || playback.error) && <p role="alert" className="text-sm text-destructive">{error || playback.error}</p>}
        {url && (
          <>
            {isVideo ? (
              <div className="relative mx-auto max-w-4xl overflow-hidden rounded-md bg-black">
                <video key={url} ref={(element) => { playback.element.current = element }} {...playback.mediaProps} playsInline className="max-h-80 w-full" />
                {activeSpeakers.size > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-1">
                    {[...activeSpeakers].map((speaker) => (
                      <Badge key={speaker} className={cn('text-white', speakerColor(speaker))}>{speakerName(speaker)}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <audio key={url} ref={(element) => { playback.element.current = element }} {...playback.mediaProps} />
            )}
            <MediaControls playback={playback} disabled={!!recording.state} />
          </>
        )}
        {result && tracks.size === 0 && <p className="text-sm text-muted-foreground">没有检测到可分轨的语音。</p>}
        {result && tracks.size > 0 && (
          <section className="space-y-3" aria-label="说话人轨道">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{tracks.size} 位说话人 · {segments.length} 段</h2>
              {activeSpeakers.size > 1 && <Badge variant="secondary">多人同时说话</Badge>}
            </div>
            <SpeakerTrackRows tracks={tracks} to={totalTime} position={position} onSeek={recording.state ? undefined : (time) => {
              playback.seek(time)
              void playback.play()
            }} />
          </section>
        )}
      </CardContent>
    </Card>
  )
}
