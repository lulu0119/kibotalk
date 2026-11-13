import { NotesMinimalisticIcon, WindowFrameIcon } from '@kibotalk/ui/icons'
import { ToggleGroup, ToggleGroupItem } from '@kibotalk/ui'
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
    <ToggleGroup
      type="single"
      className={className}
      aria-label="产品表面模式"
      value={mode}
      onValueChange={(value) => {
        if (value) patch({ productSurfaceMode: value as ProductSurfaceMode })
      }}
    >
      {MODES.map(({ value, label, hint, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} title={hint}>
          <Icon aria-hidden="true" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
