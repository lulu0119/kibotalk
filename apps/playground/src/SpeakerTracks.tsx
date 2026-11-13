import { useEffect, useId, useRef, useState } from 'react'
import type { SpeakerSegment } from '@sherpaw/speaker-diarization'
import { ImportIcon, LoaderIcon, PauseIcon, PlayIcon, SoundwaveIcon } from '@kibotalk/ui/icons'
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider, cn,
} from '@kibotalk/ui'
import { analyzeSpeakers } from './speaker-diarization'

import { groupSpeakerSegments, speakerColor, speakerName, speakerTimestamp, SpeakerTrackRows } from './components/SpeakerTrackRows'

export default function SpeakerTracks() {
  const fileInput = useRef<HTMLInputElement>(null)
  const media = useRef<HTMLMediaElement>(null)
  const pending = useRef<AbortController | null>(null)
  const [source, setSource] = useState<{ file: File; url: string }>()
  const { file, url } = source ?? {}
  const [speakerCount, setSpeakerCount] = useState('auto')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ duration: number; segments: SpeakerSegment[] }>()
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const countId = useId()

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => pending.current?.abort(), [])

  function cancel() {
    pending.current?.abort()
    pending.current = null
    setStatus('')
  }

  function selectFile(nextFile: File) {
    cancel()
    setResult(undefined)
    setDuration(0)
    setPosition(0)
    setPlaying(false)
    setError('')
    media.current?.pause()
    setSource({ file: nextFile, url: URL.createObjectURL(nextFile) })
  }

  async function analyze() {
    if (!file || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setError('')
    setResult(undefined)
    try {
      const count = speakerCount === 'auto' ? undefined : Number(speakerCount)
      const next = await analyzeSpeakers(file, count, controller.signal, (message) => {
        if (!controller.signal.aborted) setStatus(message)
      })
      if (!controller.signal.aborted) setResult(next)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (pending.current === controller) cancel()
    }
  }

  async function play() {
    try {
      await media.current?.play()
    } catch {
      setError('无法播放这个文件。')
    }
  }

  function seek(time: number) {
    if (!media.current || !Number.isFinite(media.current.duration)) return
    media.current.currentTime = Math.min(time, media.current.duration)
    setPosition(media.current.currentTime)
  }

  const segments = result?.segments ?? []
  const tracks = groupSpeakerSegments(segments)
  const isActive = ({ start, end }: SpeakerSegment) => start <= position + 0.01 && end > position
  const activeSpeakers = new Set(segments.filter(isActive).map(({ speaker }) => speaker))
  const totalTime = Math.max(duration, result?.duration ?? 0)
  const isVideo = !!file && (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name))
  const mediaProps = {
    src: url,
    preload: 'metadata',
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      const value = event.currentTarget.duration
      if (Number.isFinite(value)) setDuration(value)
    },
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) => setPosition(event.currentTarget.currentTime),
    onSeeked: (event: React.SyntheticEvent<HTMLMediaElement>) => setPosition(event.currentTarget.currentTime),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
  }

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
          <Button variant="outline" onClick={() => fileInput.current?.click()}><ImportIcon />导入音频或视频</Button>
          {file && (
            <>
              <div className="space-y-2">
                <Label htmlFor={countId}>说话人数</Label>
                <Select value={speakerCount} onValueChange={setSpeakerCount} disabled={!!status}>
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
                <Button onClick={() => void analyze()}>{result ? '重新分析' : '分析声纹'}</Button>
              )}
            </>
          )}
        </div>
        {file && <p className="text-sm text-muted-foreground wrap-break-word">{file.name}</p>}
        {status && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderIcon className="size-4 animate-spin" />{status}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {url && (
          <>
            {isVideo ? (
              <div className="relative mx-auto max-w-4xl overflow-hidden rounded-md bg-black">
                <video key={url} ref={(element) => { media.current = element }} {...mediaProps} playsInline className="max-h-80 w-full" />
                {activeSpeakers.size > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-1">
                    {[...activeSpeakers].map((speaker) => (
                      <Badge key={speaker} className={cn('text-white', speakerColor(speaker))}>{speakerName(speaker)}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <audio key={url} ref={(element) => { media.current = element }} {...mediaProps} />
            )}
            <div className="flex min-w-0 items-center gap-3">
              <Button size="icon" variant="outline" aria-label={playing ? '暂停' : '播放'} onClick={() => playing ? media.current?.pause() : void play()}>
                {playing ? <PauseIcon /> : <PlayIcon />}
              </Button>
              <Slider aria-label="播放进度" value={[position]} max={totalTime || 1} step={0.01} onValueChange={([time]) => seek(time)} disabled={!totalTime} />
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{speakerTimestamp(position)} / {speakerTimestamp(totalTime)}</span>
            </div>
          </>
        )}
        {result && tracks.size === 0 && <p className="text-sm text-muted-foreground">没有检测到可分轨的语音。</p>}
        {result && tracks.size > 0 && (
          <section className="space-y-3" aria-label="说话人轨道">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{tracks.size} 位说话人 · {segments.length} 段</h2>
              {activeSpeakers.size > 1 && <Badge variant="secondary">多人同时说话</Badge>}
              <p className="text-sm text-muted-foreground">点选片段跳转播放</p>
            </div>
            <SpeakerTrackRows tracks={tracks} to={totalTime} position={position} onSeek={(time) => {
              seek(time)
              void play()
            }} />
          </section>
        )}
      </CardContent>
    </Card>
  )
}
