import { useEffect, useRef } from 'react'
import { cssColor } from '../lib/cssColor'

interface Options {
  peaks: Float32Array
  duration: number
  /** Audible position in seconds, read each rAF frame; must be stable across renders. */
  clock: () => number
  baseAlpha?: number
  playedAlpha?: number
}

/**
 * Renders peak buckets to off-screen "dim base" + "accent played" canvases once
 * per resize, then composites them onto the visible canvas each rAF frame
 * clipped to the playhead — shared by StageWaveform and PlayerSeekWaveform,
 * which only differ in alpha and whether drag-to-seek is wired on top.
 */
export function usePeakCanvas({
  peaks,
  duration,
  clock,
  baseAlpha = 0.5,
  playedAlpha = 0.9
}: Options): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      const bucketsPerPx = peaks.length / w
      const make = (color: string, alpha: number): HTMLCanvasElement => {
        const off = document.createElement('canvas')
        off.width = w
        off.height = h
        const octx = off.getContext('2d')
        if (!octx) return off
        octx.fillStyle = color
        octx.globalAlpha = alpha
        for (let x = 0; x < w; x++) {
          const end = Math.min(Math.ceil((x + 1) * bucketsPerPx), peaks.length)
          let m = 0
          for (let i = Math.floor(x * bucketsPerPx); i < end; i++) {
            const v = peaks[i] ?? 0
            if (v > m) m = v
          }
          const bar = Math.max(m * (mid - 1), 0.5)
          octx.fillRect(x, mid - bar, 1, bar * 2)
        }
        return off
      }
      base = make(cssColor('--color-text-dim'), baseAlpha)
      played = make(cssColor('--color-accent'), playedAlpha)
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
  }, [peaks, duration, clock, baseAlpha, playedAlpha])

  return canvasRef
}
