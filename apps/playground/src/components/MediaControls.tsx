import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from '@kibotalk/ui'
import { PauseIcon, PlayIcon, RestartIcon, VolumeCrossIcon, VolumeLoudIcon } from '@kibotalk/ui/icons'
import { speakerTimestamp } from './SpeakerTrackRows'

export function useMediaPlayback(output?: (volume: number) => void) {
  const element = useRef<HTMLMediaElement>(null)
  const [source, setSource] = useState<{ file: File; url: string }>()
  const { file, url } = source ?? {}
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const clearPlaying = () => setPlaying(false)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  function load(next: File) {
    element.current?.pause()
    setDuration(0)
    setPosition(0)
    setPlaying(false)
    setError('')
    setSource({ file: next, url: URL.createObjectURL(next) })
  }

  async function play() {
    try {
      await element.current?.play()
      setError('')
    } catch {
      setError(element.current?.error ? '无法读取这个文件。' : '无法播放，请点击播放重试。')
    }
  }

  function seek(time: number) {
    const media = element.current
    if (!media || !Number.isFinite(media.duration)) return
    media.currentTime = Math.min(Math.max(0, time), media.duration)
    setPosition(media.currentTime)
  }

  function setOutput(volume: number, muted: boolean) {
    const media = element.current
    if (output) output(muted ? 0 : volume)
    else if (media) {
      media.volume = volume
      media.muted = muted
    }
  }

  const mediaProps = {
    src: url,
    preload: 'metadata',
    onLoadedMetadata: ({ currentTarget }: React.SyntheticEvent<HTMLMediaElement>) => {
      currentTarget.playbackRate = rate
      setOutput(volume, muted)
      if (Number.isFinite(currentTarget.duration)) setDuration(currentTarget.duration)
    },
    onTimeUpdate: ({ currentTarget }: React.SyntheticEvent<HTMLMediaElement>) => setPosition(currentTarget.currentTime),
    onPlay: () => setPlaying(true),
    onPause: clearPlaying,
    onEnded: clearPlaying,
    onError: () => setError('无法读取这个文件。'),
  }

  return {
    element, file, url, duration, position, playing, rate, volume, muted, error, mediaProps,
    load, play, seek,
    pause: () => element.current?.pause(),
    changeRate(next: number) {
      if (element.current) element.current.playbackRate = next
      setRate(next)
    },
    changeVolume(next: number) {
      setOutput(next, false)
      setMuted(false)
      setVolume(next)
    },
    toggleMute() {
      const nextMuted = !muted
      setOutput(volume, nextMuted)
      setMuted(nextMuted)
    },
  }
}

export type MediaPlayback = ReturnType<typeof useMediaPlayback>

export function MediaControls({ playback, disabled = false, showFileName = false, transport }: {
  playback: MediaPlayback
  disabled?: boolean
  showFileName?: boolean
  transport?: ReactNode
}) {
  const { playing, position, duration, rate, volume, muted } = playback
  const fileName = showFileName ? playback.file?.name : undefined
  return (
    <div className="@container min-w-0" role="group" aria-label="音频播放">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 @xl:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center gap-1">
          {transport === undefined ? (
            <Button type="button" size="icon" className="size-9" variant="outline" aria-label={playing ? '暂停播放' : '播放'} disabled={disabled} onClick={() => playing ? playback.pause() : void playback.play()}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
          ) : transport}
          <Button type="button" size="icon" className="size-9" variant="ghost" aria-label="回到开头" disabled={disabled || !duration} onClick={() => playback.seek(0)}>
            <RestartIcon />
          </Button>
        </div>
        <div className="col-span-2 row-start-2 grid min-w-0 gap-1 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1">
          <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
            {fileName && <span className="truncate font-medium" title={fileName}>{fileName}</span>}
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{speakerTimestamp(position)} / {speakerTimestamp(duration)}</span>
          </div>
          <Slider className="h-4" aria-label="播放进度" value={[position]} max={duration || 1} step={0.01} onValueChange={([time]) => playback.seek(time)} disabled={disabled || !duration} />
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          <Select value={String(rate)} onValueChange={(next) => playback.changeRate(Number(next))} disabled={disabled}>
            <SelectTrigger className="h-9 w-auto gap-1 px-2" aria-label="播放速度"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => <SelectItem key={speed} value={String(speed)}>{speed}×</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" className="size-9" variant="ghost" aria-label={muted ? '取消静音' : '静音'} onClick={playback.toggleMute} disabled={disabled}>
              {muted ? <VolumeCrossIcon /> : <VolumeLoudIcon />}
            </Button>
            <Slider className="h-4 w-14 @xl:w-16" aria-label="音量" value={[muted ? 0 : volume]} max={1} step={0.05} onValueChange={([next]) => playback.changeVolume(next)} disabled={disabled} />
          </div>
        </div>
      </div>
    </div>
  )
}
