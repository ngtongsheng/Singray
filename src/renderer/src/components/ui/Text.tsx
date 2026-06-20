import { cva } from 'class-variance-authority'
import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '../../lib/cn'

export type TextVariant = 'title' | 'subtitle' | 'item' | 'hint' | 'error'

const textVariant = cva('', {
  variants: {
    variant: {
      title: 'font-semibold text-base',
      subtitle: 'truncate font-semibold text-sm',
      item: 'truncate font-medium text-sm',
      hint: 'text-muted-foreground text-xs',
      error: 'text-destructive text-xs'
    }
  }
})

interface TextProps extends ComponentPropsWithoutRef<'span'> {
  as?: 'h1' | 'h2' | 'p' | 'span'
  variant: TextVariant
}

/** Shared type scale (SPEC §10.2): page/dialog titles, header subtitles, item names, hint/error text. */
function Text({ as = 'p', variant, className, ...rest }: TextProps): React.JSX.Element {
  const Tag = as as ElementType
  return <Tag className={cn(textVariant({ variant }), className)} {...rest} />
}

export default Text
