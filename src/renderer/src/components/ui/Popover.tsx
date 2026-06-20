import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

/** Anchored floating panel (Radix): outside-click + Esc close + collision flipping. */
export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>): React.JSX.Element {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-30 rounded-md border border-border bg-card shadow-raised outline-none data-[state=closed]:animate-[pop-out_100ms_ease-in] data-[state=open]:animate-[pop-in_120ms_ease-out]',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
