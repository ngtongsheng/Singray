import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lyrics } from '../../../shared/types'
import { inferEnds } from '../lib/inferEnds'

/** Flat cursor position: line index + unit index. Break lines have no units, so the cursor skips them. */
interface UnitPos {
  line: number
  unit: number
}

const RATES = [0.5, 0.7, 0.85, 1] as const

function unitT(lyrics: Lyrics, pos: UnitPos): number | null {
  return lyrics.lines[pos.line]?.units[pos.unit]?.t ?? null
}

interface Options {
  songId: string
  lyrics: Lyrics
  /** Sync every stamp up to the creator's state; persistence happens here (debounced). */
  onChange: (next: Lyrics) => void
  review: boolean
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export interface TapTimingCursor {
  playing: boolean
  setPlaying: (playing: boolean) => void
  time: number
  duration: number
  setDuration: (duration: number) => void
  rateIdx: number
  flatUnits: UnitPos[]
  stamps: number[]
  cursor: number
  currentLine: number
  done: boolean
  progressPct: number
  lineStartIdx: number[]
  togglePlay: () => void
  stamp: () => void
  undo: () => void
  seekTo: (t: number) => void
  cycleRate: (dir: 1 | -1) => void
  jumpToLine: (lineIdx: number) => void
  jumpGap: (dir: 1 | -1) => void
  registerLineRef: (li: number, el: HTMLButtonElement | null) => void
}

/**
 * Tap-along timing state machine (SPEC §6.3): cursor over flattened units,
 * debounced autosave, keyboard shortcuts (stamp/undo/seek/rate/gap-nav),
 * fix-up gap navigation post-alignment. Imperative audio control goes
 * through `audioRef`; the <audio> element itself stays in the component.
 */
export function useTapTimingCursor({
  songId,
  lyrics,
  onChange,
  review,
  audioRef
}: Options): TapTimingCursor {
  const lineRefs = useRef(new Map<number, HTMLButtonElement>())
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rateIdx, setRateIdx] = useState(3)

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
    [songId, onChange, audioRef]
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
  }, [audioRef])

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
  }, [cursor, flatUnits, lyrics, persist, audioRef])

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
  }, [audioRef])

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
    [followCursor, audioRef]
  )

  const cycleRate = useCallback(
    (dir: 1 | -1): void => {
      setRateIdx((idx) => {
        const next = Math.min(Math.max(idx + dir, 0), RATES.length - 1)
        const a = audioRef.current
        if (a) {
          a.preservesPitch = true
          a.playbackRate = RATES[next] ?? 1
        }
        return next
      })
    },
    [audioRef]
  )

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
    [flatUnits, lyrics, audioRef]
  )

  /**
   * Fix-up navigation (SPEC §6.6): Tab jumps to the next/previous untimed unit
   * and seeks just before its context (last timed unit ahead of the gap), so
   * post-alignment gaps can be filled without hunting.
   */
  const jumpGap = useCallback(
    (dir: 1 | -1): void => {
      let idx = -1
      if (dir === 1) {
        for (let k = cursor + 1; k < flatUnits.length; k++) {
          const p = flatUnits[k]
          if (p && unitT(lyrics, p) === null) {
            idx = k
            break
          }
        }
      } else {
        for (let k = Math.min(cursor, flatUnits.length) - 1; k >= 0; k--) {
          const p = flatUnits[k]
          if (p && unitT(lyrics, p) === null) {
            idx = k
            break
          }
        }
      }
      if (idx === -1) return
      setCursor(idx)
      let ref: number | null = null
      for (let k = idx - 1; k >= 0; k--) {
        const p = flatUnits[k]
        const t = p ? unitT(lyrics, p) : null
        if (t !== null) {
          ref = t
          break
        }
      }
      const a = audioRef.current
      if (a && ref !== null) a.currentTime = Math.max(ref - 1, 0)
    },
    [cursor, flatUnits, lyrics, audioRef]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (e.repeat) break
          if (review) togglePlay()
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
        case 'Tab':
          // Ctrl+Tab is the EL4 step cycle (handled in LyricCreator); plain Tab is gap-nav.
          if (e.ctrlKey) break
          e.preventDefault()
          if (!review) jumpGap(e.shiftKey ? -1 : 1)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stamp, undo, togglePlay, seekTo, cycleRate, review, jumpGap, audioRef])

  const currentLine = flatUnits[cursor]?.line ?? flatUnits[flatUnits.length - 1]?.line ?? 0

  useEffect(() => {
    lineRefs.current.get(currentLine)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentLine])

  const done = cursor >= flatUnits.length
  const progressPct =
    flatUnits.length === 0 ? 0 : Math.round((stamps.length / flatUnits.length) * 100)
  let flatIdx = 0
  const lineStartIdx = lyrics.lines.map((l) => {
    const s = flatIdx
    flatIdx += l.units.length
    return s
  })

  const registerLineRef = useCallback((li: number, el: HTMLButtonElement | null): void => {
    if (el) lineRefs.current.set(li, el)
    else lineRefs.current.delete(li)
  }, [])

  return {
    playing,
    setPlaying,
    time,
    duration,
    setDuration,
    rateIdx,
    flatUnits,
    stamps,
    cursor,
    currentLine,
    done,
    progressPct,
    lineStartIdx,
    togglePlay,
    stamp,
    undo,
    seekTo,
    cycleRate,
    jumpToLine,
    jumpGap,
    registerLineRef
  }
}
