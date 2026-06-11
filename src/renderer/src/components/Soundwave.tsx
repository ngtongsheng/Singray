import { useEffect, useRef } from 'react'

interface Props {
  analyser: AnalyserNode
  playing: boolean
}

const BARS = 96

/**
 * Stage soundwave (R1.4): frequency bars fed by the monitor-mix analyser.
 * Absolute paint-only overlay — never affects layout. The draw loop runs only
 * while playing; pausing freezes the last frame.
 */
function Soundwave({ analyser, playing }: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = (): void => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent')
      .trim()
    const data = new Uint8Array(analyser.frequencyBinCount)
    // Bottom ~2/3 of the spectrum carries the music; the top is mostly empty.
    const usableBins = Math.floor(analyser.frequencyBinCount * 0.66)
    let raf = 0

    const draw = (): void => {
      analyser.getByteFrequencyData(data)
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = accent
      const slot = width / BARS
      const barW = Math.max(1, slot * 0.6)
      for (let i = 0; i < BARS; i++) {
        const bin = Math.floor((i / BARS) * usableBins)
        const v = (data[bin] ?? 0) / 255
        const h = v * height
        ctx.fillRect(i * slot + (slot - barW) / 2, height - h, barW, h)
      }
      raf = requestAnimationFrame(draw)
    }
    if (playing) raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [analyser, playing])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-30"
    />
  )
}

export default Soundwave
