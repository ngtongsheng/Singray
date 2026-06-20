import { motion } from 'motion/react'
import { useEffect, useId, useRef } from 'react'
import { cx } from './cx'

export interface Tab<T extends string> {
  id: T
  label: string
}

interface TabsProps<T extends string> {
  tabs: readonly Tab<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

/** Clickable tab bar with a sliding accent underline (UI6). Arrow keys move focus + selection. */
function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className
}: TabsProps<T>): React.JSX.Element {
  const layoutId = useId()
  const btnRefs = useRef(new Map<T, HTMLButtonElement>())

  const move = (dir: 1 | -1): void => {
    const idx = tabs.findIndex((tab) => tab.id === active)
    const next = tabs[(idx + dir + tabs.length) % tabs.length]
    if (!next) return
    onChange(next.id)
    btnRefs.current.get(next.id)?.focus()
  }

  return (
    <div role="tablist" className={cx('relative flex gap-1 border-b border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (el) btnRefs.current.set(tab.id, el)
            else btnRefs.current.delete(tab.id)
          }}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          tabIndex={tab.id === active ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              move(1)
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              move(-1)
            }
          }}
          className={cx(
            'relative px-3 py-2 text-sm font-medium transition-colors',
            tab.id === active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          {tab.id === active && (
            <motion.div
              layoutId={`tabs-underline-${layoutId}`}
              className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
              transition={{ type: 'spring', stiffness: 550, damping: 32 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

/** Ctrl+Tab / Ctrl+Shift+Tab cycles `active` through `ids` (EL4, ADD1). */
export function useTabCycle<T extends string>(
  ids: readonly T[],
  active: T,
  onChange: (id: T) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || e.key !== 'Tab') return
      e.preventDefault()
      const idx = ids.indexOf(active)
      const next = ids[(idx + (e.shiftKey ? -1 : 1) + ids.length) % ids.length]
      if (next !== undefined) onChange(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids, active, onChange, enabled])
}

export default Tabs
