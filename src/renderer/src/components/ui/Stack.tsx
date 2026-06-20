import { cva } from 'class-variance-authority'
import type { ComponentProps, ElementType } from 'react'
import { cn } from '../../lib/cn'

export type StackGap = 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'

/** Gap scale shared with Grid (both index the same Tailwind gap-* steps). */
export const GAP: Record<StackGap, string> = {
  0: 'gap-0',
  0.5: 'gap-0.5',
  1: 'gap-1',
  1.5: 'gap-1.5',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8'
}

const stackBase = cva('flex', {
  variants: {
    direction: { row: 'flex-row', column: 'flex-col' },
    gap: GAP,
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly'
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline'
    },
    wrap: { true: 'flex-wrap' }
  },
  defaultVariants: { direction: 'row', gap: 0 }
})

export interface StackProps extends ComponentProps<'div'> {
  /** Element tag (default 'div'); 'header'/'footer' for landmark rows. */
  as?: 'div' | 'header' | 'footer'
  direction?: 'row' | 'column'
  gap?: StackGap
  justify?: StackJustify
  align?: StackAlign
  wrap?: boolean
}

/** Flex layout primitive — direction + gap. Prefer over manual flex/margin classes. */
function Stack({
  as = 'div',
  direction = 'row',
  gap = 0,
  justify,
  align,
  wrap = false,
  className,
  ...rest
}: StackProps): React.JSX.Element {
  const Tag = as as ElementType
  // Default align: 'stretch' for columns (full-width children, e.g. lists/sections),
  // 'center' for rows (vertically centered controls). Override via `align`.
  const resolvedAlign = align ?? (direction === 'column' ? 'stretch' : 'center')
  return (
    <Tag
      className={cn(stackBase({ direction, gap, justify, align: resolvedAlign, wrap }), className)}
      {...rest}
    />
  )
}

export default Stack
