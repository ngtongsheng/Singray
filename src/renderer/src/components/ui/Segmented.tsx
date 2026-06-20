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

/** Button-group radio replacement (no native radios in chrome). */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  className
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      className={cx(
        'inline-flex h-8 items-center gap-0.5 rounded-md border border-border p-0.5',
        className
      )}
    >
      {options.map((opt) => (
        // biome-ignore lint/a11y/useSemanticElements: styled segmented control, not a native radio input (no bare radios in chrome)
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cx(
            'flex h-full items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors',
            opt.value === value
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default Segmented
