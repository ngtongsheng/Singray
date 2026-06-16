import { useEffect, useRef } from 'react'

interface Props {
  peaks: Float32Array
  duration: number
  /** Engine display position — called each rAF frame; must be stable across renders. */
  clock: () => number
  onSeek: (t: number) => void
}

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Waveform seek bar for the player control bar (R3.WAVE1).
 * Dim base + accent "played" region drawn once per resize to off-screen canvases;
 * playhead is a clear+line per rAF frame — no React state update per frame.
 * Drag-to-seek uses native listeners so dragging outside the element still tracks.
 */
function PlayerSeekWaveform({ peaks, duration, clock, onSeek }: Props): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Keep latest props accessible in the drag effect without re-subscribing listeners.
  const durationRef = useRef(duration)
  const onSeekRef = useRef(onSeek)
  durationRef.current = duration
  onSeekRef.current = onSeek

  // Off-screen base (dim) + played (accent) canvases; rAF loop composites them + playhead.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let base: HTMLCanvasElement | null = null
    let played: HTMLCanvasElement | null = null

    const render = (): void => {
      const w = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio))
      const h = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio))
      canvas.width = w
      canvas.height = h
      const mid = h / 2
      const bpp = peaks.length / w
      const make = (color: string, alpha: number): HTMLCanvasElement => {
        const off = document.createElement('canvas')
        off.width = w
        off.height = h
        const oc = off.getContext('2d')
        if (!oc) return off
        oc.fillStyle = color
        oc.globalAlpha = alpha
        for (let x = 0; x < w; x++) {
          const end = Math.min(Math.ceil((x + 1) * bpp), peaks.length)
          let m = 0
          for (let i = Math.floor(x * bpp); i < end; i++) {
            const v = peaks[i] ?? 0
            if (v > m) m = v
          }
          const bar = Math.max(m * (mid - 1), 0.5)
          oc.fillRect(x, mid - bar, 1, bar * 2)
        }
        return off
      }
      base = make(cssColor('--color-text-dim'), 0.45)
      played = make(cssColor('--color-accent'), 0.85)
    }

    render()
    const ro = new ResizeObserver(render)
    ro.observe(canvas)

    const playheadColor = cssColor('--color-lyric-active')
    let raf = 0
    const loop = (): void => {
      if (base && played) {
        const { width: w, height: h } = canvas
        const x = Math.round((clock() / duration) * w)
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(base, 0, 0)
        if (x > 0) ctx.drawImage(played, 0, 0, x, h, 0, 0, x, h)
        ctx.fillStyle = playheadColor
        ctx.globalAlpha = 0.9
        ctx.fillRect(x - 1, 0, 2, h)
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [peaks, duration, clock])

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
