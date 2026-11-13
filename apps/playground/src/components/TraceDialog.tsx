import { lazy, Suspense, type ReactElement } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@kibotalk/ui'

const IoTracer = lazy(() => import('../io-tracer/IoTracer').then(({ IoTracer }) => ({ default: IoTracer })))

export function TraceDialog({ children, sample = false }: { children: ReactElement; sample?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent fullscreen aria-describedby={undefined}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{sample ? '示例 Trace' : '会话 Trace'}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1">
          <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">正在加载 Trace…</p>}>
            <IoTracer sample={sample} />
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  )
}
