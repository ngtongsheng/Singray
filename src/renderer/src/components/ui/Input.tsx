import type { ComponentProps, ReactNode } from 'react'
import { cx } from './cx'

interface InputProps extends ComponentProps<'input'> {
  /** `size` is a native input attribute, hence the prefix. */
  uiSize?: 'sm' | 'md'
  /** Leading icon, absolutely positioned; size/color it at the call site. */
  icon?: ReactNode
  /** Trailing adornment (spinner etc.), absolutely positioned. */
  trailing?: ReactNode
}

/**
 * Text input (SPEC §10.6: labels above inputs live at the call site).
 * The wrapper always renders so a conditional `trailing` (e.g. a spinner)
 * never remounts the input and drops focus.
 */
function Input({
  uiSize = 'md',
  icon,
  trailing,
  className,
  ...rest
}: InputProps): React.JSX.Element {
  return (
    <div className="relative w-full">
      {icon && (
        <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5">
          {icon}
        </span>
      )}
      <input
        className={cx(
          'w-full rounded-control border border-border bg-surface text-sm placeholder:text-text-dim/60',
          uiSize === 'md' ? 'py-2' : 'h-8',
          icon ? 'pl-8' : 'pl-3',
          'pr-3',
          className
        )}
        {...rest}
      />
      {trailing && <span className="-translate-y-1/2 absolute top-1/2 right-3">{trailing}</span>}
    </div>
  )
}

export default Input
