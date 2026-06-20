import * as SliderPrimitive from '@radix-ui/react-slider'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

interface SliderProps
  extends Omit<ComponentProps<'span'>, 'value' | 'onChange' | 'dir' | 'defaultValue'> {
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (value: number) => void
  /** Fired on pointer-up / key-up — use for expensive operations like audio seek. */
  onCommit?: (value: number) => void
  disabled?: boolean
}

/** Radix Slider (keyboard + drag a11y) wrapped to the single-number value/onChange API the
 * app already uses, so call sites keep passing a plain number instead of Radix's value[]. */
function Slider({
  min = 0,
  max = 100,
  step,
  value,
  onChange,
  onCommit,
  disabled,
  className,
  ...rest
}: SliderProps): React.JSX.Element {
  return (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={(vals) => {
        const v = vals[0]
        if (v !== undefined) onChange(v)
      }}
      onValueCommit={(vals) => {
        const v = vals[0]
        if (v !== undefined) onCommit?.(v)
      }}
      disabled={disabled}
      className={cn(
        'relative flex w-full cursor-pointer touch-none items-center select-none',
        className
      )}
      {...rest}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-3 shrink-0 rounded-full bg-foreground shadow-sm outline-none disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  )
}

export default Slider
