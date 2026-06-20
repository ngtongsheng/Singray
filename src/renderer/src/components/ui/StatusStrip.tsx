import { clsx as cx } from 'clsx'
import type { ReactNode } from 'react'
import Stack from './Stack'

interface StatusStripProps {
  /** 0–1; renders a thin accent fill across the top edge when set. */
  progress?: number
  /** Overlay pinned to the bottom of the nearest positioned ancestor. Default: sits in normal flow. */
  pinned?: boolean
  className?: string
  children: ReactNode
}

/** Thin status bar: border-t + surface bg, optional progress fill. Shared by import/timing/mic-status strips. */
function StatusStrip({
  progress,
  pinned = false,
  className,
  children
}: StatusStripProps): React.JSX.Element {
  return (
    <div
      className={cx(
        'relative border-border border-t bg-card px-6 py-1.5',
        pinned && 'absolute inset-x-0 bottom-0 z-20',
        className
      )}
    >
      {progress !== undefined && (
        <div
          className="absolute top-0 left-0 h-0.5 bg-primary transition-[width] duration-300" // design-allow: width isn't in Tailwind's transition-property presets
          style={{ width: `${progress * 100}%` }}
        />
      )}
      <Stack gap={2} align="center" className="h-full text-muted-foreground text-xs">
        {children}
      </Stack>
    </div>
  )
}

export default StatusStrip
