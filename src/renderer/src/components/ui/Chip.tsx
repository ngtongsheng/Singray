import type { ComponentProps } from 'react'
import { cx } from './cx'
import Toggle from './Toggle'

interface ChipProps extends ComponentProps<'button'> {
  active: boolean
}

/** Pill filter chip (library filter row) — an outline Toggle, shares control height. */
function Chip({ active, className, ...rest }: ChipProps): React.JSX.Element {
  return (
    <Toggle
      pressed={active}
      variant="secondary"
      size="sm"
      className={cx('rounded-full', className)}
      {...rest}
    />
  )
}

export default Chip
