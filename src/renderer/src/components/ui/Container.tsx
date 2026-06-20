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

export interface ContainerProps extends ComponentProps<'div'> {
  pb?: ContainerPb
  maxWidth?: ContainerMaxWidth
}

/** Page-level scroll container, fixed below the Titlebar; scrolling via ScrollArea. */
function Container({
  pb = 0,
  maxWidth,
  className,
  children,
  ...rest
}: ContainerProps): React.JSX.Element {
  return (
    <div className={cn('absolute inset-0 pt-19', className)} {...rest}>
      <ScrollArea className="h-full">
        <div className={cn('pl-6 pr-6', PB[pb])}>
          {maxWidth ? <div className={MAX_WIDTH[maxWidth]}>{children}</div> : children}
        </div>
      </ScrollArea>
    </div>
  )
}

export default Container
