import { SoundwaveIcon } from '@kibotalk/ui/icons'
import { speakerWindowSeconds, type LiveSpeakerLane } from '../live-speaker-tracks'
import { groupSpeakerSegments, SpeakerTrackRows, speakerTimestamp } from './SpeakerTrackRows'

const laneStatusLabels: Record<LiveSpeakerLane['status'], string> = {
  loading: '正在准备声纹模型…',
  ready: '等待语音',
  ended: '没有可分轨的语音',
  error: '说话人分轨中断。',
}

export function LiveSpeakerTracks({ lanes, usesFile }: { lanes: LiveSpeakerLane[]; usesFile: boolean }) {
  const time = Math.max(0, ...lanes.map((lane) => lane.time))
  const from = Math.max(0, time - speakerWindowSeconds)
  const to = Math.max(10, time)
  return (
    <div className="flex h-36 shrink-0 flex-col gap-2 border-t bg-muted/30 px-4 py-3 sm:px-6">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><SoundwaveIcon className="size-4" />说话人分轨</h3>
        {lanes.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">{speakerTimestamp(from)}–{speakerTimestamp(to)}</span>
        )}
      </div>
      <div
        role="region"
        aria-label="说话人轨道"
        tabIndex={0}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-ring"
      >
        {lanes.length === 0 && <p className="text-xs text-muted-foreground">等待会话开始</p>}
        {lanes.map(({ input, status, segments, owner }) => {
          const tracks = groupSpeakerSegments(segments.filter(({ end }) => end > from))
          const label = usesFile ? '音频文件' : input === 'microphone' ? '麦克风' : '共享音频'
          const announcing = status === 'loading' || status === 'error'
          return (
            <section key={input} aria-label={`${label}分轨`}>
              {lanes.length > 1 && (
                <h4 className="mb-1 text-xs font-medium text-muted-foreground">{label}</h4>
              )}
              {tracks.size > 0 && <SpeakerTrackRows tracks={tracks} from={from} to={to} owner={owner} />}
              {(announcing || tracks.size === 0) && (
                <p className={status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} role={announcing ? 'status' : undefined}>
                  {laneStatusLabels[status]}
                </p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
