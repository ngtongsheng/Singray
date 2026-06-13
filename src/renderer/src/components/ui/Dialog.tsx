import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useMotionPresets } from '../../lib/motionPresets'
import { cx } from './cx'

interface DialogProps {
  label: string
  /** alertdialog role for confirms. */
  alert?: boolean
  /** Panel width, e.g. 'w-[420px]'. */
  width: string
  onClose: () => void
  children: ReactNode
}

/**
 * Modal scaffold (SPEC §10.6): 50% scrim, raised panel, Esc + scrim-click closes
 * (scrim-click disabled for `alert` dialogs — those require an explicit choice).
 * Render inside an AnimatePresence so the exit spring runs.
 */
function Dialog({ label, alert, width, onClose, children }: DialogProps): React.JSX.Element {
  const { dialogScrim, dialogPanel } = useMotionPresets()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      {...dialogScrim}
      onClick={(e) => {
        if (!alert && e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
    >
      <motion.div
        {...dialogPanel}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={label}
        className={cx('rounded-card border border-border bg-surface-2 p-6 shadow-raised', width)}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export default Dialog
