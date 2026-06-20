import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'
import { ScrollArea } from './ScrollArea'

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

export interface ContainerProps extends ComponentProps<typeof ScrollArea> {
  pb?: ContainerPb
  maxWidth?: ContainerMaxWidth
}

/**
 * Page-level scroll container. Radix ScrollArea overlays the thumb so no
 * scrollbar-gutter compensation needed — symmetric pl-6/pr-6.
 */
function Container({
  pb = 0,
  maxWidth,
  className,
  children,
  ...rest
}: ContainerProps): React.JSX.Element {
  return (
    <ScrollArea className={cn('absolute inset-0', className)} {...rest}>
      <div className={cn('pl-6 pr-6 pt-19', PB[pb])}>
        {maxWidth ? <div className={MAX_WIDTH[maxWidth]}>{children}</div> : children}
      </div>
    </ScrollArea>
  )
}

export default Container
