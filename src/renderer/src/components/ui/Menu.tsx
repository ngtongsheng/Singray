import type { MouseEvent, ReactNode } from 'react'
import { createContext, useCallback, useContext, useState } from 'react'
import { cn } from '../../lib/cn'
import { Popover, PopoverAnchor, PopoverContent } from './Popover'

const MenuClose = createContext<() => void>(() => {})

interface MenuProps {
  /** Render the trigger; wire `toggle` to its onClick (it stops propagation). */
  trigger: (open: boolean, toggle: (e: MouseEvent) => void) => ReactNode
  /** Corner the menu grows from; maps to Radix align (right→end, left→start). */
  origin: string
  /** Panel sizing/padding (positioning is handled by Radix). */
  className: string
  children: ReactNode
}

/** Dropdown menu (Radix Popover): outside-click + Esc close, items close on select. */
function Menu({ trigger, origin, className, children }: MenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const align = origin.includes('right') ? 'end' : origin.includes('left') ? 'start' : 'center'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        {trigger(open, (e) => {
          e.stopPropagation()
          setOpen(!open)
        })}
      </PopoverAnchor>
      <MenuClose.Provider value={close}>
        <PopoverContent align={align} sideOffset={4} className={cn('py-1', className)}>
          {children}
        </PopoverContent>
      </MenuClose.Provider>
    </Popover>
  )
}

interface MenuItemProps {
  danger?: boolean
  onSelect: () => void
  children: ReactNode
}

export function MenuItem({ danger, onSelect, children }: MenuItemProps): React.JSX.Element {
  const close = useContext(MenuClose)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        close()
        onSelect()
      }}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted',
        danger && 'text-destructive'
      )}
    >
      {children}
    </button>
  )
}

export default Menu
