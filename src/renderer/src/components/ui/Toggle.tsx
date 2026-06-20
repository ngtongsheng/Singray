import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cn } from '../../lib/cn'
import { type ButtonProps, buttonBase, buttonVariantClass } from './Button'

interface ToggleProps extends Omit<ButtonProps, 'active'> {
  pressed: boolean
}

/** Radix Toggle (a11y pressed-state semantics) layered with Button's size/variant classes —
 * Radix's Toggle has no native size prop, so it borrows Button's cva base directly. */
function Toggle({
  pressed,
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ToggleProps): React.JSX.Element {
  return (
    <TogglePrimitive.Root
      pressed={pressed}
      className={
        variant === 'bare'
          ? className
          : cn(buttonBase({ size }), buttonVariantClass(variant, pressed), className)
      }
      {...rest}
    />
  )
}

export default Toggle
