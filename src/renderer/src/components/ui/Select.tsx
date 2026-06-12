import type { ComponentProps } from 'react'
import { cx } from './cx'

interface SelectProps extends ComponentProps<'select'> {
  /** md = full-width form field; sm = compact inline control. */
  uiSize?: 'sm' | 'md'
}

/** Native select on surface tokens. */
function Select({ uiSize = 'md', className, ...rest }: SelectProps): React.JSX.Element {
  return (
    <select
      className={cx(
        'rounded-control border border-border bg-surface text-sm disabled:opacity-50',
        uiSize === 'md' ? 'w-full px-3 py-2' : 'px-2 py-1 text-text-dim',
        className
      )}
      {...rest}
    />
  )
}

export default Select
