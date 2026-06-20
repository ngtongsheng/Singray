import { cva } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { type ButtonProps, buttonVariantClass } from './Button'

type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg'

/* Matches Button's h-8/h-9/h-10 scale so an icon button sits flush next to a text
 * button or input in the same row — md is the stock shadcn icon size (size-9). */
const iconButtonBase = cva(
  'flex shrink-0 cursor-pointer items-center justify-center p-0 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      size: {
        xs: 'size-7',
        sm: 'size-8',
        md: 'size-9',
        lg: 'size-10'
      },
      round: {
        true: 'rounded-full',
        false: 'rounded-md'
      }
    },
    defaultVariants: { size: 'sm', round: false }
  }
)

interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  size?: IconButtonSize
  /** Circular (player transport) instead of the control radius. */
  round?: boolean
}

/** Square icon-only button; same variants as Button. */
function IconButton({
  variant = 'secondary',
  size = 'sm',
  active,
  round,
  className,
  ...rest
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={
        variant === 'bare'
          ? className
          : cn(iconButtonBase({ size, round }), buttonVariantClass(variant, active), className)
      }
      {...rest}
    />
  )
}

export default IconButton
