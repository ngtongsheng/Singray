import type { ComponentProps } from 'react'
import { cx } from './cx'

type SliderProps = Omit<ComponentProps<'input'>, 'type'>

/** Native range input on the accent color; size via className. */
function Slider({ className, ...rest }: SliderProps): React.JSX.Element {
  return <input type="range" className={cx('cursor-pointer accent-accent', className)} {...rest} />
}

export default Slider
