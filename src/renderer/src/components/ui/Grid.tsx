import type { ComponentProps } from 'react'
import { cx } from './cx'
import { GAP, type StackGap } from './Stack'

export type GridCols = 1 | 2 | 3 | 4 | 6 | 12

const COLS: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  6: 'grid-cols-6',
  12: 'grid-cols-12'
}

export interface GridProps extends ComponentProps<'div'> {
  /** Fixed column count. */
  cols?: GridCols
  /** Responsive auto-fill columns, each at least this wide (px). */
  minItemWidth?: number
  autoRows?: 'min'
  gap?: StackGap
}

/** Grid layout primitive — fixed `cols` or responsive `minItemWidth` auto-fill. */
function Grid({
  cols,
  minItemWidth,
  autoRows,
  gap = 0,
  className,
  style,
  ...rest
}: GridProps): React.JSX.Element {
  return (
    <div
      className={cx(
        'grid',
        cols !== undefined && COLS[cols],
        autoRows === 'min' && 'auto-rows-min',
        GAP[gap],
        className
      )}
      style={
        minItemWidth !== undefined
          ? { gridTemplateColumns: `repeat(auto-fill, minmax(${minItemWidth}px, 1fr))`, ...style }
          : style
      }
      {...rest}
    />
  )
}

export default Grid
