import type { ComponentProps } from 'react'
import { cx } from './cx'

export type ContainerPb = 0 | 4 | 6 | 8 | 10 | 12
export type ContainerMaxWidth = 'lg' | 'xl'

const PB: Record<ContainerPb, string> = {
  0: 'pb-0',
  4: 'pb-4',
  6: 'pb-6',
  8: 'pb-8',
  10: 'pb-10',
  12: 'pb-12'
}

const MAX_WIDTH: Record<ContainerMaxWidth, string> = {
  lg: 'mx-auto max-w-lg',
  xl: 'mx-auto max-w-xl'
}

export interface ContainerProps extends ComponentProps<'div'> {
  pb?: ContainerPb
  /** Centers content to a max width (forms), instead of running full-width. */
  maxWidth?: ContainerMaxWidth
}

/**
 * Page-level scroll container: sits below the floating header (pt-19),
 * edges at pl-6/pr-[14px] (24px visual both sides — pr compensates for the
 * 10px scrollbar-gutter reserved by .overflow-y-auto in main.css).
 */
function Container({
  pb = 0,
  maxWidth,
  className,
  children,
  ...rest
}: ContainerProps): React.JSX.Element {
  return (
    <div
      className={cx('absolute inset-0 overflow-y-auto pl-6 pr-[14px] pt-19', PB[pb], className)} // design-allow: scrollbar-gutter compensation (comment above)
      {...rest}
    >
      {maxWidth ? <div className={MAX_WIDTH[maxWidth]}>{children}</div> : children}
    </div>
  )
}

export default Container
