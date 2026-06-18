import { useEffect, useRef } from 'react'
import { usePeakCanvas } from '../../hooks/usePeakCanvas'

interface Props {
  peaks: Float32Array
  duration: number
  /** Engine display position — called each rAF frame; must be stable across renders. */
  clock: () => number
  onSeek: (t: number) => void
}

/**
 * Waveform seek bar for the player control bar (R3.WAVE1).
 * Dim base + accent "played" region drawn once per resize to off-screen canvases;
 * playhead is a clear+line per rAF frame — no React state update per frame.
 * Drag-to-seek uses native listeners so dragging outside the element still tracks.
 */
function PlayerSeekWaveform({ peaks, duration, clock, onSeek }: Props): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = usePeakCanvas({ peaks, duration, clock, baseAlpha: 0.45, playedAlpha: 0.85 })

  // Keep latest props accessible in the drag effect without re-subscribing listeners.
  const durationRef = useRef(duration)
  const onSeekRef = useRef(onSeek)
  durationRef.current = duration
  onSeekRef.current = onSeek

  // Drag-to-seek: native listeners so mousemove/up work outside the element.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let dragging = false
    const toTime = (clientX: number): number => {
      const rect = root.getBoundingClientRect()
      const dur = durationRef.current
      return Math.max(0, Math.min(dur, ((clientX - rect.left) / rect.width) * dur))
    }
    const onDown = (e: MouseEvent): void => {
      if (e.button !== 0) return
      dragging = true
      onSeekRef.current(toTime(e.clientX))
    }
    const onMove = (e: MouseEvent): void => {
      if (dragging) onSeekRef.current(toTime(e.clientX))
    }
    const onUp = (): void => {
      dragging = false
    }
    root.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      root.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative h-11 flex-1 cursor-pointer">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  )
}

export default PlayerSeekWaveform
