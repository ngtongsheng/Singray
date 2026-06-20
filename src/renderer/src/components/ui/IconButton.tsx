import { type ButtonProps, buttonVariantClass } from './Button'
import { cx } from './cx'

type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE: Record<IconButtonSize, string> = {
  xs: 'size-7',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-11'
}

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
          : cx(
              'inline-flex shrink-0 items-center justify-center disabled:opacity-50',
              round ? 'rounded-full' : 'rounded-md',
              SIZE[size],
              buttonVariantClass(variant, active),
              className
            )
      }
      {...rest}
    />
  )
}

export default IconButton
