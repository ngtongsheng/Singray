import type { ComponentProps } from 'react'
import { cx } from './cx'

interface ChipProps extends ComponentProps<'button'> {
  active: boolean
}

/** Pill filter chip (library filter row). */
function Chip({ active, className, ...rest }: ChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={cx(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border text-text-dim hover:border-text-dim hover:text-text',
        className
      )}
      {...rest}
    />
  )
}

export default Chip
