import { NotesMinimalisticIcon, WindowFrameIcon } from '@kibotalk/ui/icons'
import { Button, cn } from '@kibotalk/ui'
import { useConfig, type ProductSurfaceMode } from '../config-store'

const MODES: Array<{ value: ProductSurfaceMode; label: string; hint: string; icon: typeof WindowFrameIcon }> = [
  { value: 'window', label: '窗口', hint: '应用内卡片，无便利贴', icon: WindowFrameIcon },
  { value: 'floating', label: '悬浮', hint: '模拟 Island + 便利贴', icon: NotesMinimalisticIcon },
]

/**
 * Playground-only switch: window product UI vs simulated floating stickies.
 */
export function ProductSurfaceToggle({ className }: { className?: string }) {
  const mode = useConfig((s) => s.productSurfaceMode)
  const patch = useConfig((s) => s.patch)

  return (
    <div
      className={cn('inline-flex rounded-md border border-border/60 bg-muted/40 p-0.5', className)}
      role="group"
      aria-label="产品表面模式"
    >
      {MODES.map(({ value, label, hint, icon: Icon }) => {
        const active = mode === value
        return (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
            className={cn(!active && 'text-muted-foreground')}
            aria-pressed={active}
            title={hint}
            onClick={() => patch({ productSurfaceMode: value })}
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        )
      })}
    </div>
  )
}
