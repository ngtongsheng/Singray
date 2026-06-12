import { useEffect, useState } from 'react'

/**
 * Shared motion presets (R2.2, SPEC §10.5): micro-interactions 150–250ms,
 * ease-out enter / ease-in exit at ~70% of the enter duration. Under
 * prefers-reduced-motion every preset collapses to nothing (§10.5: disable
 * everything except the lyric wipe), so components spread the same props
 * either way.
 */

/** Dialog backdrop: plain fade. */
const dialogScrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' as const } },
  transition: { duration: 0.2, ease: 'easeOut' as const }
}

/** Dialog panel: quick spring in, tween out (exit springs feel sluggish). */
const dialogPanel = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: 'easeIn' as const } },
  transition: { type: 'spring' as const, stiffness: 550, damping: 32 }
}

/** Popover / menu: same spring, slight rise instead of full-panel scale. */
const popover = {
  initial: { opacity: 0, scale: 0.95, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.12, ease: 'easeIn' as const } },
  transition: { type: 'spring' as const, stiffness: 550, damping: 32 }
}

const none = {}

interface MotionPresets {
  dialogScrim: typeof dialogScrim | typeof none
  dialogPanel: typeof dialogPanel | typeof none
  popover: typeof popover | typeof none
}

/**
 * Reactive prefers-reduced-motion (motion's useReducedMotion reads the value
 * once at mount and never updates, so a live OS toggle wouldn't take effect).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function useMotionPresets(): MotionPresets {
  const reduced = usePrefersReducedMotion()
  return reduced
    ? { dialogScrim: none, dialogPanel: none, popover: none }
    : { dialogScrim, dialogPanel, popover }
}
