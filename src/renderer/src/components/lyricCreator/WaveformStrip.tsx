import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { computePeaks } from '../../lib/computePeaks'
import { cssColor } from '../../lib/cssColor'
import { Button } from '../ui'

interface Props {
  songId: string
  /** Shared transport element — playhead reads currentTime directly, no React re-render per frame. */
  audioRef: React.RefObject<HTMLAudioElement | null>
  /** Stamped unit times, drawn as ticks. */
  stamps: number[]
  onSeek: (t: number) => void
}

interface Peaks {
  data: Float32Array
  duration: number
}

/** Fixed-rate peak buckets, independent of canvas width; mapped to pixels at draw time. */
const PEAKS_PER_SEC = 100
const HEIGHT = 64

function sizeCanvas(canvas: HTMLCanvasElement, w: number, dpr: number): CanvasRenderingContext2D {
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(HEIGHT * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

/**
 * Vocals waveform under the transport (SPEC §6.5). Peaks decoded + rendered once to a
 * base canvas (redrawn only on resize/stamp change); a separate overlay canvas carries
 * the playhead so the per-frame redraw is a clearRect + one line.
 */
function WaveformStrip({ songId, audioRef, stamps, onSeek }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLButtonElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<Peaks | null>(null)
  const [failed, setFailed] = useState(false)

  // Decode vocals.m4a once per song; keep only normalized max-abs buckets, drop the buffer.
  useEffect(() => {
    let cancelled = false
    setPeaks(null)
    setFailed(false)
    const run = async (): Promise<void> => {
      const res = await fetch(window.singray.audio.url(songId, 'vocals'))
      if (!res.ok) throw new Error(`vocals fetch ${res.status}`)
      const raw = await res.arrayBuffer()
      const ctx = new AudioContext()
      try {
        const audio = await ctx.decodeAudioData(raw)
        const data = computePeaks([audio], audio.duration, PEAKS_PER_SEC)
        if (!cancelled) setPeaks({ data, duration: audio.duration })
      } finally {
        void ctx.close()
      }
    }
    run().catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [songId])

  // Base layer: waveform + stamped-unit ticks. Redraws on decode, stamp change, resize.
  useEffect(() => {
    const wrap = wrapRef.current
    const base = baseRef.current
    const overlay = overlayRef.current
    if (!wrap || !base || !overlay || !peaks) return

    const draw = (): void => {
      const w = wrap.clientWidth
      if (w === 0) return
      const dpr = window.devicePixelRatio || 1
      const ctx = sizeCanvas(base, w, dpr)
      sizeCanvas(overlay, w, dpr)

      const mid = HEIGHT / 2
      const bucketsPerPx = peaks.data.length / w
      ctx.fillStyle = cssColor('--color-text-dim')
      ctx.globalAlpha = 0.55
      for (let x = 0; x < w; x++) {
        const end = Math.min(Math.ceil((x + 1) * bucketsPerPx), peaks.data.length)
        let m = 0
        for (let i = Math.floor(x * bucketsPerPx); i < end; i++) {
          const v = peaks.data[i] ?? 0
          if (v > m) m = v
        }
        const h = Math.max(m * (mid - 2), 0.5)
        ctx.fillRect(x, mid - h, 1, h * 2)
      }

      ctx.globalAlpha = 0.9
      ctx.fillStyle = cssColor('--color-accent-soft')
      for (const t of stamps) {
        const x = Math.round((t / peaks.duration) * w)
        ctx.fillRect(x, 0, 1, 10)
      }
      ctx.globalAlpha = 1
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [peaks, stamps])

  // Overlay layer: playhead only, full-rate rAF straight off the audio element.
  useEffect(() => {
    if (!peaks) return
    let raf = 0
    const color = cssColor('--color-lyric-active')
    const loop = (): void => {
      const overlay = overlayRef.current
      const a = audioRef.current
      if (overlay && a) {
        const ctx = overlay.getContext('2d')
        if (ctx) {
          const dpr = window.devicePixelRatio || 1
          const w = overlay.width / dpr
          ctx.clearRect(0, 0, w, HEIGHT)
          const x = (a.currentTime / peaks.duration) * w
          ctx.fillStyle = color
          ctx.fillRect(x - 0.75, 0, 1.5, HEIGHT)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [peaks, audioRef])

  return (
    <div className="border-border border-b px-6 py-2">
      <Button
        ref={wrapRef}
        variant="bare"
        tabIndex={-1}
        title={t('timing.clickToSeek')}
        className="relative block w-full cursor-pointer"
        style={{ height: HEIGHT }}
        onClick={(e) => {
          if (!peaks) return
          const rect = e.currentTarget.getBoundingClientRect()
          onSeek(((e.clientX - rect.left) / rect.width) * peaks.duration)
          e.currentTarget.blur()
        }}
      >
        <canvas ref={baseRef} className="absolute inset-0 size-full" />
        <canvas ref={overlayRef} className="absolute inset-0 size-full" />
        {!peaks && (
          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground/60 text-xs">
            {failed ? t('timing.waveformUnavailable') : t('timing.waveformRendering')}
          </span>
        )}
      </Button>
    </div>
  )
}

export default WaveformStrip
