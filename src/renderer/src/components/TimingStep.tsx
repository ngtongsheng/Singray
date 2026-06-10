import { Eye, Keyboard, Pause, Play, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lyrics } from '../../../shared/types'
import { inferEnds } from '../lib/inferEnds'
import ReviewPane from './ReviewPane'
import WaveformStrip from './WaveformStrip'

interface Props {
  songId: string
  lyrics: Lyrics
  /** Sync every stamp up to the creator's state; persistence happens here (debounced). */
  onChange: (next: Lyrics) => void
}

/** Flat cursor position: line index + unit index. Break lines have no units, so the cursor skips them. */
interface UnitPos {
  line: number
  unit: number
}

const RATES = [0.5, 0.7, 0.85, 1] as const

function fmt(t: number): string {
  const m = Math.floor(t / 60)
  return `${m}:${(t % 60).toFixed(1).padStart(4, '0')}`
}

function unitT(lyrics: Lyrics, pos: UnitPos): number | null {
  return lyrics.lines[pos.line]?.units[pos.unit]?.t ?? null
}

/** Tap-along timing step (SPEC §6.3): Space stamps, original.m4a as reference. */
function TimingStep({ songId, lyrics, onChange }: Props): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const lineRefs = useRef(new Map<number, HTMLButtonElement>())
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rateIdx, setRateIdx] = useState(3)
  const [showKeys, setShowKeys] = useState(true)
  const [review, setReview] = useState(false)

  const flatUnits = useMemo<UnitPos[]>(
    () => lyrics.lines.flatMap((l, line) => l.units.map((_, unit) => ({ line, unit }))),
    [lyrics]
  )

  const stamps = useMemo<number[]>(
    () =>
      lyrics.lines.flatMap((l) => l.units.map((u) => u.t).filter((t): t is number => t !== null)),
    [lyrics]
  )

  // Resume at the first unstamped unit (crash/quit-safe).
  const [cursor, setCursor] = useState(() => {
    const idx = flatUnits.findIndex((p) => unitT(lyrics, p) === null)
    return idx === -1 ? flatUnits.length : idx
  })

  // Debounced autosave; flush on unmount. Parent state is already synced via onChange.
  const dirtyRef = useRef<Lyrics | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persist = useCallback(
    (next: Lyrics): void => {
      // End inference (SPEC §6.4) on every write keeps lyrics.json valid after the last stamp.
      const withEnds = inferEnds(next, audioRef.current?.duration || 0)
      onChange(withEnds)
      dirtyRef.current = withEnds
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        dirtyRef.current = null
        void window.singray.lyrics.save(songId, withEnds)
      }, 1000)
    },
    [songId, onChange]
  )
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (dirtyRef.current) void window.singray.lyrics.save(songId, dirtyRef.current)
    },
    [songId]
  )

  // Clock: rAF read of audio time, quantized to 0.1s so re-renders stay ~10Hz.
  useEffect(() => {
    let raf = 0
    const loop = (): void => {
      const a = audioRef.current
      if (a) setTime(Math.round(a.currentTime * 10) / 10)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const stamp = useCallback((): void => {
    const pos = flatUnits[cursor]
    const a = audioRef.current
    if (!pos || !a) return
    const t = a.currentTime
    const next = structuredClone(lyrics)
    const line = next.lines[pos.line]
    const unit = line?.units[pos.unit]
    if (!line || !unit) return
    unit.t = t
    if (pos.unit === 0) line.start = t
    persist(next)
    setCursor(cursor + 1)
  }, [cursor, flatUnits, lyrics, persist])

  const undo = useCallback((): void => {
    const pos = flatUnits[cursor - 1]
    if (!pos) return
    const next = structuredClone(lyrics)
    const line = next.lines[pos.line]
    const unit = line?.units[pos.unit]
    if (!line || !unit) return
    unit.t = null
    if (pos.unit === 0) line.start = null
    persist(next)
    setCursor(cursor - 1)
  }, [cursor, flatUnits, lyrics, persist])

  const togglePlay = useCallback((): void => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play()
    else a.pause()
  }, [])

  /** After any seek: if we landed before already-stamped units, re-tap from there (SPEC §6.3). */
  const followCursor = useCallback(
    (t: number): void => {
      const idx = flatUnits.findIndex((p) => {
        const ut = unitT(lyrics, p)
        return ut !== null && ut >= t
      })
      if (idx !== -1 && idx < cursor) setCursor(idx)
    },
    [flatUnits, lyrics, cursor]
  )

  const seekTo = useCallback(
    (t: number): void => {
      const a = audioRef.current
      if (!a) return
      a.currentTime = Math.min(Math.max(t, 0), a.duration || 0)
      followCursor(a.currentTime)
    },
    [followCursor]
  )

  const cycleRate = useCallback((dir: 1 | -1): void => {
    setRateIdx((idx) => {
      const next = Math.min(Math.max(idx + dir, 0), RATES.length - 1)
      const a = audioRef.current
      if (a) {
        a.preservesPitch = true
        a.playbackRate = RATES[next] ?? 1
      }
      return next
    })
  }, [])

  const jumpToLine = useCallback(
    (lineIdx: number): void => {
      const idx = flatUnits.findIndex((p) => p.line === lineIdx)
      if (idx === -1) return
      setCursor(idx)
      const start = lyrics.lines[lineIdx]?.start
      if (start !== null && start !== undefined) {
        const a = audioRef.current
        if (a) a.currentTime = Math.max(start - 2, 0)
      }
    },
    [flatUnits, lyrics]
  )

  /** SPEC §6.7: Space in review re-enters tap mode at the line currently playing. */
  const exitReview = useCallback((): void => {
    const t = audioRef.current?.currentTime ?? 0
    let lineIdx = -1
    lyrics.lines.forEach((l, li) => {
      if (l.units.length > 0 && l.start !== null && l.start <= t) lineIdx = li
    })
    if (lineIdx === -1) lineIdx = lyrics.lines.findIndex((l) => l.units.length > 0)
    const idx = flatUnits.findIndex((p) => p.line === lineIdx)
    if (idx !== -1) setCursor(idx)
    setReview(false)
  }, [flatUnits, lyrics])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (e.repeat) break
          if (review) exitReview()
          else stamp()
          break
        case 'Backspace':
          e.preventDefault()
          if (!e.repeat && !review) undo()
          break
        case 'Enter':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekTo((audioRef.current?.currentTime ?? 0) - 5)
          break
        case 'ArrowRight':
          e.preventDefault()
          seekTo((audioRef.current?.currentTime ?? 0) + 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          cycleRate(1)
          break
        case 'ArrowDown':
          e.preventDefault()
          cycleRate(-1)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stamp, undo, togglePlay, seekTo, cycleRate, review, exitReview])

  const currentLine = flatUnits[cursor]?.line ?? flatUnits[flatUnits.length - 1]?.line ?? 0

  useEffect(() => {
    lineRefs.current.get(currentLine)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentLine])

  const done = cursor >= flatUnits.length
  let flatIdx = 0
  const lineStartIdx = lyrics.lines.map((l) => {
    const s = flatIdx
    flatIdx += l.units.length
    return s
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* biome-ignore lint/a11y/useMediaCaption: timing reference track; the lyrics ARE the captions being authored */}
      <audio
        ref={audioRef}
        src={window.singray.audio.url(songId, 'original')}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <div className="flex items-center gap-4 border-border border-b px-6 py-3">
        <button
          type="button"
          onClick={(e) => {
            togglePlay()
            e.currentTarget.blur()
          }}
          title={playing ? 'Pause (Enter)' : 'Play (Enter)'}
          className="rounded-control bg-accent p-2.5 text-text hover:bg-accent-soft"
        >
          {playing ? (
            <Pause className="size-5" strokeWidth={2} />
          ) : (
            <Play className="size-5" strokeWidth={2} />
          )}
        </button>
        <span className="font-semibold text-2xl tabular-nums">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(time, duration)}
          onChange={(e) => seekTo(Number(e.target.value))}
          onMouseUp={(e) => e.currentTarget.blur()}
          className="flex-1 accent-accent"
        />
        <span className="text-sm text-text-dim tabular-nums">{fmt(duration)}</span>
        <span className="rounded-control border border-border px-2 py-1 text-sm text-text-dim tabular-nums">
          {RATES[rateIdx]}×
        </span>
        <button
          type="button"
          onClick={(e) => {
            if (review) exitReview()
            else setReview(true)
            e.currentTarget.blur()
          }}
          title={review ? 'Back to tap mode (Space)' : 'Review timing'}
          className={`flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-sm ${
            review
              ? 'border-accent text-accent-soft hover:bg-surface'
              : 'border-border text-text-dim hover:bg-surface hover:text-text'
          }`}
        >
          {review ? (
            <>
              <Keyboard className="size-4" strokeWidth={1.5} /> Tap
            </>
          ) : (
            <>
              <Eye className="size-4" strokeWidth={1.5} /> Review
            </>
          )}
        </button>
      </div>

      <WaveformStrip songId={songId} audioRef={audioRef} stamps={stamps} onSeek={seekTo} />

      {review ? (
        <ReviewPane lyrics={lyrics} audioRef={audioRef} onSeek={seekTo} />
      ) : (
        <>
          <div className="flex min-h-28 items-center justify-center px-6 py-6">
            {done ? (
              <p className="font-lyric text-2xl text-success">
                All units stamped — ready for review
              </p>
            ) : (
              <p className="max-w-full text-center font-lyric text-4xl leading-snug">
                {lyrics.lines[currentLine]?.units.map((u, ui) => {
                  const idx = (lineStartIdx[currentLine] ?? 0) + ui
                  return (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: unit order is stable for a given line
                      key={ui}
                      className={
                        idx < cursor
                          ? 'text-lyric-sung'
                          : idx === cursor
                            ? 'border-accent border-b-2 text-lyric-active'
                            : 'text-lyric-pending/50'
                      }
                    >
                      {u.text}
                    </span>
                  )
                })}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-6 pb-4">
            {lyrics.lines.map((line, li) =>
              line.units.length === 0 ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable while timing
                <div key={li} className="px-3 py-1 text-text-dim/40 tracking-widest">
                  · · ·
                </div>
              ) : (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable while timing
                  key={li}
                  type="button"
                  ref={(el) => {
                    if (el) lineRefs.current.set(li, el)
                    else lineRefs.current.delete(li)
                  }}
                  tabIndex={-1}
                  onClick={(e) => {
                    jumpToLine(li)
                    e.currentTarget.blur()
                  }}
                  className={`flex w-full items-baseline gap-3 rounded-control px-3 py-1 text-left font-lyric text-base hover:bg-surface ${
                    li === currentLine && !done ? '' : 'opacity-40'
                  }`}
                >
                  <span className="w-14 shrink-0 text-text-dim text-xs tabular-nums">
                    {line.start !== null ? fmt(line.start) : '—'}
                  </span>
                  <span className={li === currentLine && !done ? 'text-lyric-active' : ''}>
                    {line.text}
                  </span>
                </button>
              )
            )}
          </div>
        </>
      )}

      {showKeys && (
        <div className="flex items-center gap-5 border-border border-t bg-surface px-6 py-2 text-text-dim text-xs">
          {review ? (
            <Hint k="Space" label="back to tap" />
          ) : (
            <>
              <Hint k="Space" label="stamp unit" />
              <Hint k="⌫" label="undo" />
            </>
          )}
          <Hint k="Enter" label="play / pause" />
          <Hint k="← →" label="±5s" />
          <Hint k="↑ ↓" label="speed" />
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowKeys(false)}
            title="Hide shortcuts"
            className="rounded-control p-1 hover:bg-surface-2 hover:text-text"
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function Hint({ k, label }: { k: string; label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans">{k}</kbd>
      {label}
    </span>
  )
}

export default TimingStep
