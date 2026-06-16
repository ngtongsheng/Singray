import { useEffect, useRef } from 'react'

interface Props {
  /** Normalized 0..1 max-abs peak buckets of the full mix. */
  peaks: Float32Array
  duration: number
  /** Audible position in seconds (latency-compensated engine clock). */
  clock: () => number
}

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Stage waveform (creator-style): whole-song peaks drawn once to a dim base and
 * an accent copy; each frame blits the accent copy clipped to the playhead and
 * draws the playhead line. Paint-only absolute overlay, no layout impact.
 */
function StageWaveform({ peaks, duration, clock }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Off-screen base (dim) + played (accent) renders, redone on resize.
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
      base = make(cssColor('--color-text-dim'), 0.5)
      played = make(cssColor('--color-accent'), 0.9)
    }

    render()
    const ro = new ResizeObserver(render)
    ro.observe(canvas)

    const lyricActive = cssColor('--color-lyric-active')
    let raf = 0
    const loop = (): void => {
      if (base && played) {
        const { width: w, height: h } = canvas
        const x = Math.round((clock() / duration) * w)
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(base, 0, 0)
        if (x > 0) ctx.drawImage(played, 0, 0, x, h, 0, 0, x, h)
        ctx.fillStyle = lyricActive
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

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
}

export default StageWaveform
