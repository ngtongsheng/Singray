import * as TabsPrimitive from '@radix-ui/react-tabs'
import { useEffect } from 'react'
import { cn } from '../../lib/cn'

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

/** Stock shadcn tab bar (muted pill list). Radix's roving-tabindex list gives arrow-key nav
 * for free, replacing the old hand-rolled move()/onKeyDown + motion sliding underline. */
function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className
}: TabsProps<T>): React.JSX.Element {
  return (
    <TabsPrimitive.Root value={active} onValueChange={(v) => onChange(v as T)}>
      <TabsPrimitive.List
        className={cn(
          'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px]',
          className
        )}
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className="inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
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
