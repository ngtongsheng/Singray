import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lyrics } from '../../../../shared/types'
import { Button } from '../ui'

interface Props {
  lyrics: Lyrics
  /** Master clock (SPEC §7.3) — read every animation frame. */
  clock: () => number
  onSeek: (t: number) => void
  /** Show bottom gradient fade (false in review mode so the full lyric list is visible). */
  showGradient?: boolean
}

type Role = 'past' | 'current' | 'future'

interface LineMeta {
  isBreak: boolean
  /** When this line becomes "current": its start, or for breaks the preceding line's end. */
  effStart: number | null
  /** For breaks: surrounding gap, drives the dot countdown (≥5s gaps only, SPEC §7.1). */
  gapStart: number | null
  gapEnd: number | null
  units: { t: number | null; end: number | null }[]
}

const MIN_COUNTDOWN_GAP = 5
/** Non-current lines render at 48px and scale down — layout never changes, so the
 * per-frame loop and line transitions are transform/paint only (SPEC §10.7.4). */
const DIM_SCALE = 'scale(0.52)'

/**
 * Player lyric renderer (SPEC §7.1). React renders the line list once per lyrics
 * object; a rAF loop drives everything time-dependent imperatively — unit wipe
 * gradient (paint), line role flips + column auto-scroll (transform), break dots
 * (opacity). Zero layout work per frame.
 */
function LyricRenderer({ lyrics, clock, onSeek, showGradient = true }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const viewRef = useRef<HTMLDivElement>(null)
  const colRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<(HTMLElement | null)[]>([])
  const unitEls = useRef<HTMLSpanElement[][]>([])

  const meta = useMemo<LineMeta[]>(() => {
    return lyrics.lines.map((line, li) => {
      if (line.units.length === 0) {
        // Break: current during the gap between its timed neighbours.
        const prev = lyrics.lines.slice(0, li).findLast((l) => l.units.length > 0 && l.end !== null)
        const next = lyrics.lines.slice(li + 1).find((l) => l.units.length > 0 && l.start !== null)
        const gapStart = prev?.end ?? null
        const gapEnd = next?.start ?? null
        const big = gapStart !== null && gapEnd !== null && gapEnd - gapStart >= MIN_COUNTDOWN_GAP
        return {
          isBreak: true,
          effStart: big ? gapStart : null,
          gapStart,
          gapEnd,
          units: []
        }
      }
      return {
        isBreak: false,
        effStart: line.start,
        gapStart: null,
        gapEnd: null,
        units: line.units.map((u, ui) => ({
          t: u.t,
          end: line.units[ui + 1]?.t ?? line.end
        }))
      }
    })
  }, [lyrics])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let prevCur = -2 // force initial styling pass
    let raf = 0

    // The bottom mask fades the last 120px to transparent, so that strip never
    // reads as occupied — bias the target up by half of it or the current line
    // looks centered on the math but low to the eye.
    const centerBias = showGradient ? 60 : 0

    const center = (cur: number): void => {
      const view = viewRef.current
      const col = colRef.current
      const el = lineEls.current[Math.max(cur, 0)]
      if (!view || !col || !el) return
      const y = view.clientHeight / 2 - centerBias - (el.offsetTop + el.offsetHeight / 2)
      col.style.transform = `translateY(${y}px)`
    }

    const restyleAll = (cur: number): void => {
      meta.forEach((m, i) => {
        const el = lineEls.current[i]
        if (!el) return
        const role: Role = i === cur ? 'current' : i < cur ? 'past' : 'future'
        if (el.dataset.role === role) return
        el.dataset.role = role
        el.style.transform = role === 'current' ? 'scale(1)' : DIM_SCALE
        if (m.isBreak) {
          for (const dot of Array.from(el.children)) (dot as HTMLElement).style.opacity = ''
        } else {
          for (const u of unitEls.current[i] ?? []) {
            u.style.cssText = ''
            u.dataset.state = role === 'past' ? 'sung' : 'pending'
          }
        }
      })
    }

    const tick = (): void => {
      const time = clock()
      if (import.meta.env.DEV) (window as Window & { __lrTime?: number }).__lrTime = time
      let cur = -1
      meta.forEach((m, i) => {
        if (m.effStart !== null && m.effStart <= time) cur = i
      })
      if (cur !== prevCur) {
        restyleAll(cur)
        center(cur)
        prevCur = cur
      }
      const m = meta[cur]
      const el = lineEls.current[cur]
      if (m && el) {
        if (m.isBreak && m.gapStart !== null && m.gapEnd !== null) {
          // Three dots draining with the clock (SPEC §10.6).
          const remaining = (m.gapEnd - time) / (m.gapEnd - m.gapStart)
          const shown = Math.ceil(Math.min(Math.max(remaining, 0), 1) * 3)
          Array.from(el.children).forEach((dot, i) => {
            ;(dot as HTMLElement).style.opacity = i < shown ? '1' : '0.15'
          })
        } else if (!m.isBreak) {
          const els = unitEls.current[cur] ?? []
          m.units.forEach((u, i) => {
            const span = els[i]
            if (!span) return
            const rawState =
              u.t === null || time < u.t
                ? 'pending'
                : u.end === null || time >= u.end
                  ? 'sung'
                  : 'wipe'
            const state = reducedMotion && rawState === 'wipe' ? 'sung' : rawState
            if (state === 'wipe' && u.t !== null && u.end !== null) {
              const p = ((time - u.t) / (u.end - u.t)) * 100
              span.dataset.state = 'wipe'
              span.style.backgroundImage = `linear-gradient(90deg, var(--color-lyric-sung) ${p}%, var(--color-lyric-active) ${p}%)`
              span.style.backgroundClip = 'text'
              span.style.setProperty('-webkit-background-clip', 'text')
              span.style.color = 'transparent'
            } else if (span.dataset.state !== state) {
              span.dataset.state = state
              span.style.cssText = ''
            }
          })
        }
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    const ro = new ResizeObserver(() => center(prevCur))
    if (viewRef.current) ro.observe(viewRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [meta, clock, showGradient])

  const cjk = lyrics.language === 'zh' || lyrics.language === 'ja' || lyrics.language === 'ko'

  return (
    <div
      ref={viewRef}
      className={`relative h-full overflow-hidden${
        showGradient
          ? ' [-webkit-mask-image:linear-gradient(to_bottom,black,black_calc(100%-220px),transparent_calc(100%-120px))] [mask-image:linear-gradient(to_bottom,black,black_calc(100%-220px),transparent_calc(100%-120px))]'
          : ''
      }`}
    >
      <div
        ref={colRef}
        className={`absolute inset-x-0 top-0 mx-auto px-8 font-lyric transition-transform duration-300 ease-out will-change-transform ${
          cjk ? 'max-w-[28ch] text-5xl' : 'max-w-[60ch] text-5xl' // design-allow: ch-based width tracks glyph count, no token fits
        }`}
      >
        {lyrics.lines.map((line, li) =>
          line.units.length === 0 ? (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable for a given lyrics object
              key={li}
              ref={(el) => {
                lineEls.current[li] = el
              }}
              data-role="future"
              style={{ transform: DIM_SCALE }}
              className="py-2 text-center text-muted-foreground transition-transform duration-300 ease-out will-change-transform"
            >
              <span className="inline-block px-3 transition-opacity duration-150">●</span>
              <span className="inline-block px-3 transition-opacity duration-150">●</span>
              <span className="inline-block px-3 transition-opacity duration-150">●</span>
            </div>
          ) : (
            <Button
              // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable for a given lyrics object
              key={li}
              variant="bare"
              tabIndex={-1}
              ref={(el) => {
                lineEls.current[li] = el
              }}
              data-role="future"
              style={{ transform: DIM_SCALE }}
              onClick={(e) => {
                if (line.start !== null) onSeek(line.start)
                e.currentTarget.blur()
              }}
              disabled={line.start === null}
              title={line.start === null ? t('player.unsyncedTip') : undefined}
              className="block w-full origin-center cursor-pointer py-1.5 text-center font-semibold leading-snug transition-transform duration-300 ease-out will-change-transform data-[role=past]:opacity-30 data-[role=future]:opacity-60 disabled:cursor-default disabled:opacity-40"
            >
              {line.units.map((u, ui) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: unit order is stable for a given line
                  key={ui}
                  ref={(el) => {
                    let arr = unitEls.current[li]
                    if (!arr) {
                      arr = []
                      unitEls.current[li] = arr
                    }
                    if (el) arr[ui] = el
                  }}
                  data-state="pending"
                  className="data-[state=pending]:text-lyric-pending data-[state=sung]:text-lyric-sung"
                >
                  {u.text}
                </span>
              ))}
            </Button>
          )
        )}
      </div>
    </div>
  )
}

export default LyricRenderer
