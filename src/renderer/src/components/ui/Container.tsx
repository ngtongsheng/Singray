import { cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'
import { ScrollArea } from './ScrollArea'

type ContainerPb = 0 | 4 | 6 | 8 | 10 | 12
type ContainerMaxWidth = 'lg' | 'xl'

const containerPb = cva('pl-6 pr-6', {
  variants: {
    pb: {
      0: 'pb-0',
      4: 'pb-4',
      6: 'pb-6',
      8: 'pb-8',
      10: 'pb-10',
      12: 'pb-12'
    }
  },
  defaultVariants: { pb: 0 }
})

const containerMaxWidth = cva('', {
  variants: {
    maxWidth: {
      lg: 'mx-auto max-w-lg',
      xl: 'mx-auto max-w-xl'
    }
  }
})

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
        <div className={containerPb({ pb })}>
          {maxWidth ? <div className={containerMaxWidth({ maxWidth })}>{children}</div> : children}
        </div>
      </ScrollArea>
    </div>
  )
}

export default Container
