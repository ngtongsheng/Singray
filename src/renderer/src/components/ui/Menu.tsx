import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import type { MouseEvent, ReactNode } from 'react'
import { useState } from 'react'
import { cn } from '../../lib/cn'

interface MenuProps {
  /** Render the trigger; wire `toggle` to its onClick. `toggle` only stops the click from
   * bubbling into a parent card's role="button" handler — Radix's own Trigger click wiring
   * still drives the actual open/close (composed in after ours, since stopPropagation alone
   * doesn't set defaultPrevented). */
  trigger: (open: boolean, toggle: (e: MouseEvent) => void) => ReactNode
  /** Corner the menu grows from; maps to Radix align (right→end, left→start). */
  origin: string
  /** Panel sizing/padding (positioning is handled by Radix). */
  className: string
  children: ReactNode
}

/** Dropdown menu (Radix DropdownMenu): outside-click + Esc close, roving focus, items close
 * on select. */
function Menu({ trigger, origin, className, children }: MenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const align = origin.includes('right') ? 'end' : origin.includes('left') ? 'start' : 'center'

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger asChild>
        {trigger(open, (e) => e.stopPropagation())}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={4}
          className={cn(
            'z-30 min-w-32 overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

interface MenuItemProps {
  danger?: boolean
  onSelect: () => void
  children: ReactNode
}

export function MenuItem({ danger, onSelect, children }: MenuItemProps): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex w-full cursor-default items-center gap-2 rounded-sm px-3 py-1.5 text-left text-sm outline-none select-none',
        danger
          ? 'text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive'
          : 'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground'
      )}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  )
}

export default Menu
