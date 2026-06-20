import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import type { ReactNode } from 'react'
import { cx } from './cx'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  className?: string
}

/** Button-group radio replacement (no native radios in chrome) — Radix ToggleGroup
 * gives roving-tabindex arrow-key nav; `type="single"` is kept always-one-selected by
 * ignoring the deselect-to-empty value Radix emits when the active item is re-clicked. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  className
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T)
      }}
      className={cx(
        'inline-flex h-9 items-center gap-0.5 rounded-md border border-input p-0.5',
        className
      )}
    >
      {options.map((opt) => (
        <ToggleGroupPrimitive.Item
          key={opt.value}
          value={opt.value}
          title={opt.title}
          className={cx(
            'flex h-full items-center justify-center gap-1.5 rounded-sm px-2.5 text-sm font-medium transition-colors',
            'data-[state=on]:bg-primary/15 data-[state=on]:text-primary',
            'data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground'
          )}
        >
          {opt.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export default Segmented
