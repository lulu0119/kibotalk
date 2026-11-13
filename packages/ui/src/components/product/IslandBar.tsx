import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { MoveDuotoneIcon } from '../../icons'
import { cn } from '../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export type IslandBarProps = React.HTMLAttributes<HTMLDivElement>

/** Window dragging is handled by `IslandDragHandle`. */
export function IslandBar({ className, children, ...props }: IslandBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="悬浮岛"
      className={cn('island-bar flex items-center p-1 [-webkit-app-region:no-drag]', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function IslandStatus({
  label,
  pulse,
  toneClassName = 'bg-stone-400',
  onClick,
}: {
  label: string
  pulse?: boolean
  /** Tailwind background class for the status dot. */
  toneClassName?: string
  /** Makes the status an action, such as reopening onboarding. */
  onClick?: () => void
}) {
  const className = 'flex min-w-19 items-center justify-center gap-1.5 rounded-full px-2 py-1.5'
  const dot = (
    <span className={cn('size-1.5 shrink-0 rounded-full', toneClassName, pulse && 'motion-safe:animate-pulse')} />
  )
  const text = <span className="max-w-24 truncate text-xs">{label}</span>

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(className, 'transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-primary-soft-strong')}
      >
        {dot}
        {text}
      </button>
    )
  }

  return (
    <div className={className} role="status">
      {dot}
      {text}
    </div>
  )
}

export function IslandSeparator() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-white/10" aria-hidden />
}

/**
 * Dedicated move affordance (four-way arrow). Desktop uses pointer-capture +
 * IPC window positioning because `-webkit-app-region: drag` is unreliable on
 * the blurred Island bar and conflicts with click-through / tooltips.
 */
export function IslandDragHandle({ label = '拖动可移动悬浮窗' }: { label?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      data-island-drag-handle
      className="island-action cursor-move"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const el = event.currentTarget
        const startScreenX = event.screenX
        const startScreenY = event.screenY
        const desktop = (
          window as unknown as {
            kibotalk?: {
              island?: {
                getBounds?: () => Promise<{ x: number; y: number; width: number; height: number }>
                setPosition?: (x: number, y: number) => Promise<void>
                setPointerThrough?: (ignored: boolean) => Promise<void>
              }
            }
          }
        ).kibotalk?.island
        if (!desktop?.getBounds || !desktop?.setPosition) return
        event.preventDefault()
        void desktop.setPointerThrough?.(false)
        void desktop.getBounds().then((bounds) => {
          const originX = bounds.x
          const originY = bounds.y
          const onMove = (moveEvent: PointerEvent) => {
            void desktop.setPosition?.(
              originX + moveEvent.screenX - startScreenX,
              originY + moveEvent.screenY - startScreenY,
            )
          }
          const onUp = () => {
            el.releasePointerCapture(event.pointerId)
            el.removeEventListener('pointermove', onMove)
            el.removeEventListener('pointerup', onUp)
            el.removeEventListener('pointercancel', onUp)
          }
          el.setPointerCapture(event.pointerId)
          el.addEventListener('pointermove', onMove)
          el.addEventListener('pointerup', onUp)
          el.addEventListener('pointercancel', onUp)
        })
      }}
    >
      <MoveDuotoneIcon className="pointer-events-none" />
    </div>
  )
}

type IslandButtonProps = React.ComponentProps<'button'> & {
  label: string
}

export function IslandToggleButton({ on, ...props }: IslandButtonProps & { on: boolean }) {
  return <IslandNavButton aria-pressed={on} {...props} />
}

export function IslandNavButton({
  label,
  children,
  className,
  asChild,
  ...props
}: IslandButtonProps & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Component
          type="button"
          aria-label={label}
          className={cn('island-action', className)}
          {...props}
        >
          {children}
        </Component>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
