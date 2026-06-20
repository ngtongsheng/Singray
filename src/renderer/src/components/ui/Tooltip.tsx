import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface TooltipProps {
  content: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactNode
}

/** Hover/focus tooltip (Radix): wraps a single focusable trigger. */
function Tooltip({ content, side = 'top', children }: TooltipProps): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              'z-40 rounded-md border border-border bg-card px-2 py-1 text-foreground text-xs shadow-raised',
              'data-[state=closed]:animate-[fade-out_100ms_ease-in] data-[state=delayed-open]:animate-[fade-in_120ms_ease-out]'
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export default Tooltip
