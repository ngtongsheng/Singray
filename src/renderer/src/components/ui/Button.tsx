import { cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'bare'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'bare'

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
      return 'bg-primary font-medium text-primary-foreground hover:bg-accent-soft'
    case 'danger':
      return 'bg-destructive font-medium text-destructive-foreground hover:opacity-90'
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

/** Structural base + size (cva); variant colors come from buttonVariantClass. Sizes match
 * stock shadcn's buttonVariants so controls in a row (button/input/select/...) share heights.
 * Exported so Toggle.tsx can apply the same classes to Radix's Toggle primitive, which has
 * no native size prop. */
export const buttonBase = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 py-2 text-sm',
        lg: 'h-10 px-8 text-sm',
        bare: ''
      }
    },
    defaultVariants: { size: 'md' }
  }
)

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Accent "engaged" styling (toggle on, non-default value). */
  active?: boolean
}

/** Standard control button. `variant="bare"` opts out of all styling (content-like buttons). */
function Button({
  variant = 'secondary',
  size = 'md',
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
          : cn(buttonBase({ size }), buttonVariantClass(variant, active), className)
      }
      {...rest}
    />
  )
}

export default Button
