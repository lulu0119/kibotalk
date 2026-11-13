import { Badge, Button, cn } from '@kibotalk/ui'

const colors = [
  'bg-sky-700 hover:bg-sky-800',
  'bg-violet-700 hover:bg-violet-800',
  'bg-emerald-700 hover:bg-emerald-800',
  'bg-rose-700 hover:bg-rose-800',
  'bg-orange-700 hover:bg-orange-800',
  'bg-indigo-700 hover:bg-indigo-800',
]

export function speakerColor(speaker: number | null) {
  return speaker === null ? 'bg-stone-500' : colors[speaker % colors.length]
}

export function speakerName(speaker: number | null) {
  return speaker === null ? '未识别' : `说话人 ${speaker + 1}`
}

export function speakerTimestamp(seconds: number) {
  const rounded = Math.floor(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

type Interval = {
  id?: number
  start: number
  end: number
  speaker: number | null
  live?: boolean
  overlap?: boolean
}

export function groupSpeakerSegments<T extends Interval>(segments: readonly T[]) {
  const tracks = new Map<number | null, T[]>()
  for (const segment of segments) {
    const track = tracks.get(segment.speaker) ?? []
    track.push(segment)
    tracks.set(segment.speaker, track)
  }
  return tracks
}

export function SpeakerTrackRows({
  tracks,
  from = 0,
  to,
  position,
  onSeek,
  owner,
}: {
  tracks: ReadonlyMap<number | null, readonly Interval[]>
  from?: number
  to: number
  position?: number
  onSeek?: (time: number) => void
  owner?: number
}) {
  const duration = Math.max(0.01, to - from)
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      {[...tracks].map(([speaker, segments]) => {
        const color = speakerColor(speaker)
        const name = speaker === owner ? '我' : speakerName(speaker)
        const active = segments.some((segment) => isActive(segment, position))
        const speaking = active && position === undefined
        return (
          <div key={speaker ?? 'unknown'} className="col-span-2 grid grid-cols-subgrid items-center" aria-label={name}>
            <div className={cn('flex items-center gap-1.5 text-sm', position === undefined ? 'whitespace-nowrap' : 'flex-wrap', !onSeek && 'w-28')} title={speaking ? '说话中' : undefined}>
              <span aria-hidden="true" className={cn(
                'relative size-2 shrink-0 rounded-full', color,
                speaking && 'after:absolute after:-inset-0.5 after:rounded-full after:bg-inherit after:opacity-30 motion-safe:after:animate-pulse',
              )} />
              <span className={cn(speaking && 'font-semibold')}>{name}</span>
              {speaking && <span className="sr-only">说话中</span>}
              {active && position !== undefined && <Badge variant="secondary">当前</Badge>}
            </div>
            <div className={cn('relative min-w-0 overflow-hidden rounded-md border bg-muted/50', onSeek ? 'h-10' : 'h-7')}>
              {segments.filter(({ start, end }) => end > from && start < to && end > start).map((segment) => {
                const { start, end, live, overlap } = segment
                const label = `${name}，${speakerTimestamp(start)} 到 ${speakerTimestamp(end)}${overlap ? ' · 有重叠语音' : ''}`
                const style = {
                  left: `${100 * (Math.max(start, from) - from) / duration}%`,
                  width: `${100 * (Math.min(end, to) - Math.max(start, from)) / duration}%`,
                }
                const segmentClass = cn('absolute inset-y-1 h-auto min-w-1 rounded-sm', color, live && 'opacity-60')
                return onSeek ? (
                  <Button
                    key={segment.id ?? start}
                    size="sm"
                    variant="outline"
                    aria-label={label}
                    aria-current={isActive(segment, position) || undefined}
                    title={label}
                    className={cn(segmentClass, 'border-0 p-0', isActive(segment, position) && 'ring-2 ring-foreground ring-offset-1')}
                    style={style}
                    onClick={() => onSeek(start)}
                  />
                ) : (
                  <span
                    key={segment.id ?? start}
                    role="img"
                    aria-label={label}
                    title={label}
                    className={cn(segmentClass, overlap && 'border border-dashed border-white')}
                    style={style}
                  />
                )
              })}
              {position !== undefined && (
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: `${100 * (position - from) / duration}%` }} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function isActive({ live, start, end }: Interval, position?: number) {
  return position === undefined ? Boolean(live) : start <= position + 0.01 && end > position
}
