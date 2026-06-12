import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useMotionPresets } from '../../lib/motionPresets'
import { cx } from './cx'

interface PopoverProps {
  open: boolean
  /** transform-origin (e.g. 'bottom right') — the corner the popover grows from. */
  origin: string
  /** Position + padding, relative to the nearest `relative` ancestor. */
  className: string
  children: ReactNode
}

/** Anchored floating panel with the shared spring; caller owns open state. */
function Popover({ open, origin, className, children }: PopoverProps): React.JSX.Element {
  const { popover } = useMotionPresets()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...popover}
          style={{ transformOrigin: origin }}
          className={cx(
            'absolute z-20 rounded-control border border-border bg-surface shadow-raised',
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Popover
