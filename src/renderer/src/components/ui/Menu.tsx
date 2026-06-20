import type { MouseEvent, ReactNode } from 'react'
import { createContext, useCallback, useContext, useState } from 'react'
import { usePopoverClose } from '../../hooks/usePopoverClose'
import { cx } from './cx'
import Popover from './Popover'

const MenuClose = createContext<() => void>(() => {})

interface MenuProps {
  /** Render the trigger; wire `toggle` to its onClick (it stops propagation). */
  trigger: (open: boolean, toggle: (e: MouseEvent) => void) => ReactNode
  origin: string
  /** Popover position + panel padding. */
  className: string
  children: ReactNode
}

/** Dropdown menu: outside click + Esc close, items close on select. */
function Menu({ trigger, origin, className, children }: MenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const rootRef = usePopoverClose(open, close)

  return (
    <div ref={rootRef} className="relative">
      {trigger(open, (e) => {
        e.stopPropagation()
        setOpen(!open)
      })}
      <MenuClose.Provider value={close}>
        <Popover open={open} origin={origin} className={className}>
          {children}
        </Popover>
      </MenuClose.Provider>
    </div>
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
      className={cx(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted',
        danger && 'text-destructive'
      )}
    >
      {children}
    </button>
  )
}

export default Menu
