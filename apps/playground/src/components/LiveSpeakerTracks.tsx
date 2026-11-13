import { Card, CardContent } from '@kibotalk/ui'
import { SoundwaveIcon } from '@kibotalk/ui/icons'
import { speakerWindowSeconds, type LiveSpeakerLane } from '../live-speaker-tracks'
import { groupSpeakerSegments, SpeakerTrackRows, speakerTimestamp } from './SpeakerTrackRows'

export function LiveSpeakerTracks({ lanes }: { lanes: LiveSpeakerLane[] }) {
  const time = Math.max(...lanes.map((lane) => lane.time))
  const from = Math.max(0, time - speakerWindowSeconds)
  const to = Math.max(10, time)
  return (
    <Card className="shrink-0">
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><SoundwaveIcon className="size-4" />说话人分轨</h2>
          <span className="text-xs tabular-nums text-muted-foreground">{speakerTimestamp(from)}–{speakerTimestamp(to)}</span>
        </div>
        <div className="max-h-36 space-y-3 overflow-auto">
          {lanes.map(({ input, status, segments }) => {
            const tracks = groupSpeakerSegments(segments.filter(({ end }) => end > from))
            return (
              <section key={input} aria-label={input === 'microphone' ? '麦克风分轨' : '共享音频分轨'}>
                {lanes.length > 1 && (
                  <h3 className="mb-1 text-xs font-medium text-muted-foreground">{input === 'microphone' ? '麦克风' : '共享音频'}</h3>
                )}
                {tracks.size > 0 && <SpeakerTrackRows tracks={tracks} from={from} to={to} />}
                {status === 'error' && <p className="text-xs text-destructive" role="status">说话人分轨中断。</p>}
                {status === 'loading' && <p className="text-xs text-muted-foreground" role="status">正在准备声纹模型…</p>}
                {status === 'ready' && tracks.size === 0 && <p className="text-xs text-muted-foreground">等待语音</p>}
                {status === 'ended' && tracks.size === 0 && <p className="text-xs text-muted-foreground">没有可分轨的语音</p>}
              </section>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
