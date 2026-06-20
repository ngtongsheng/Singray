import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type DialogWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const WIDTH: Record<DialogWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl'
}

interface DialogProps {
  label: string
  /** alertdialog role for confirms: outside-click won't close (Esc still does). */
  alert?: boolean
  /** Panel max-width tier (Tailwind's max-w-* scale, no arbitrary px). */
  width: DialogWidth
  onClose: () => void
  children: ReactNode
}

/**
 * Modal scaffold (SPEC §10.6): Radix Dialog gives focus-trap + focus-return +
 * scroll-lock the hand-rolled version lacked. 50% scrim, raised panel, Esc +
 * scrim-click close (scrim-click disabled for `alert` — explicit choice required).
 * Always mounted-as-open; the parent controls presence by rendering it or not.
 */
function Dialog({ label, alert, width, onClose, children }: DialogProps): React.JSX.Element {
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=closed]:animate-[fade-out_100ms_ease-in] data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <DialogPrimitive.Content
          role={alert ? 'alertdialog' : 'dialog'}
          aria-label={label}
          onInteractOutside={(e) => alert && e.preventDefault()}
          className={cn(
            '-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-40 w-full rounded-lg border border-border bg-muted p-6 shadow-raised outline-none data-[state=closed]:animate-[pop-out_100ms_ease-in] data-[state=open]:animate-[pop-in_120ms_ease-out]',
            WIDTH[width]
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default Dialog
