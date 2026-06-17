import type { ReactNode } from 'react'
import Stack, { type StackGap } from './Stack'

interface Props {
  children: ReactNode
  gap?: StackGap
}

/** Right-aligned action row for a dialog's bottom (Cancel / primary action). */
function DialogFooter({ children, gap = 3 }: Props): React.JSX.Element {
  return (
    <Stack justify="end" gap={gap}>
      {children}
    </Stack>
  )
}

export default DialogFooter
