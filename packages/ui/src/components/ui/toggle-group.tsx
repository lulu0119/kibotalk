import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'
import { toggleVariants } from './toggle'

type ToggleGroupContextValue = VariantProps<typeof toggleVariants>

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  variant: 'default',
  size: 'default',
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & ToggleGroupContextValue
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      variant === 'chip' ? 'flex items-center gap-2' : [
        'relative inline-flex overflow-hidden rounded-lg bg-card',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-border',
      ],
      className,
    )}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const chip = (context.variant ?? variant) === 'chip'
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: chip ? 'chip' : null,
          size: context.size ?? size,
        }),
        !chip && [
          'rounded-none border-s font-medium text-muted-foreground first:border-s-0 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset',
          'data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:hover:bg-muted',
          'disabled:opacity-100 disabled:text-muted-foreground/70 data-[state=on]:disabled:text-muted-foreground',
          '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        ],
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
