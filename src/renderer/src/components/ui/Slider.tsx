import type { ComponentProps, CSSProperties } from 'react'
import { cx } from './cx'

type SliderProps = Omit<ComponentProps<'input'>, 'type'>

/** De-native range input (UI4): CSS-only track/thumb restyle, native keyboard + drag kept. */
function Slider({
  className,
  style,
  min = 0,
  max = 100,
  value,
  ...rest
}: SliderProps): React.JSX.Element {
  const lo = Number(min)
  const hi = Number(max)
  const v = Number(value ?? lo)
  const pct = hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      style={{ ...style, '--slider-pct': `${pct}%` } as CSSProperties}
      className={cx('slider cursor-pointer', className)}
      {...rest}
    />
  )
}

export default Slider
