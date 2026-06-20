import { cva } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/cn'

const inputBase = cva(
  'w-full rounded-md border border-input bg-card pr-3 text-sm placeholder:text-muted-foreground/60',
  {
    variants: {
      uiSize: {
        md: 'h-9 py-1',
        sm: 'h-8'
      },
      icon: {
        true: 'pl-8',
        false: 'pl-3'
      }
    },
    defaultVariants: { uiSize: 'md', icon: false }
  }
)

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
      <input className={cn(inputBase({ uiSize, icon: Boolean(icon) }), className)} {...rest} />
      {trailing && <span className="-translate-y-1/2 absolute top-1/2 right-3">{trailing}</span>}
    </div>
  )
}

export default Input
