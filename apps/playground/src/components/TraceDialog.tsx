import { lazy, Suspense, type ReactElement, type ReactNode, type RefObject } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@kibotalk/ui'
import type { createPlaybackTrace } from '../file-audio'
import { MediaControls, type MediaPlayback } from './MediaControls'

const IoTracer = lazy(() => import('../io-tracer/IoTracer').then(({ IoTracer }) => ({ default: IoTracer })))

export function TraceDialog({ children, sample = false, playback, playbackTrace, playbackDisabled, playbackTransport }: {
  children: ReactElement
  sample?: boolean
  playback?: MediaPlayback
  playbackTrace?: RefObject<ReturnType<typeof createPlaybackTrace> | null>
  playbackDisabled?: boolean
  playbackTransport?: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent fullscreen aria-describedby={undefined}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{sample ? '示例 Trace' : '会话 Trace'}</DialogTitle>
        </DialogHeader>
        {playback && <MediaControls playback={playback} disabled={playbackDisabled} transport={playbackTransport} />}
        <div className="min-h-0 min-w-0 flex-1">
          <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">正在加载 Trace…</p>}>
            <IoTracer sample={sample} playback={playback && playbackTrace ? {
              cursor: () => playbackTrace.current?.cursor(playback.element.current?.currentTime ?? 0),
              seek: (time) => {
                const position = playbackTrace.current?.position(time)
                if (!playbackDisabled && position !== undefined) playback.seek(position)
              },
            } : undefined} />
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  )
}
