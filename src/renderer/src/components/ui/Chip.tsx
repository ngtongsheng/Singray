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
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
        className
      )}
      {...rest}
    />
  )
}

export default Chip
