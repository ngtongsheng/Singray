import type { ComponentProps } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'bare'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'bare'

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'h-11 px-3 text-sm',
  bare: ''
}

/**
 * Variant classes shared by Button and IconButton (SPEC §10.4: one primary
 * per screen, secondary = outline on border, destructive = danger).
 *
 * `active` is the accent "engaged" state (toggle on / non-default value).
 * When it's a boolean the variant owns the text color; when undefined the
 * caller may set color via className without conflicting utilities.
 */
export function buttonVariantClass(variant: ButtonVariant, active?: boolean): string {
  switch (variant) {
    case 'primary':
      return 'bg-primary font-medium text-foreground hover:bg-accent-soft'
    case 'danger':
      return 'bg-destructive font-medium text-foreground hover:opacity-90'
    case 'secondary':
      if (active === undefined) return 'border border-border hover:bg-card'
      return active
        ? 'border border-primary bg-primary/15 text-primary'
        : 'border border-border text-muted-foreground hover:bg-card hover:text-foreground'
    case 'ghost':
      if (active === undefined) return 'hover:bg-card'
      return active
        ? 'bg-primary/15 text-primary'
        : 'text-muted-foreground hover:bg-card hover:text-foreground'
    case 'bare':
      return ''
  }
}

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Accent "engaged" styling (toggle on, non-default value). */
  active?: boolean
}

/** Standard control button. `variant="bare"` opts out of all styling (content-like buttons). */
function Button({
  variant = 'secondary',
  size = 'sm',
  active,
  className,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={
        variant === 'bare'
          ? className
          : cx(
              'inline-flex items-center justify-center gap-1.5 rounded-md disabled:opacity-50',
              SIZE[size],
              buttonVariantClass(variant, active),
              className
            )
      }
      {...rest}
    />
  )
}

export default Button
