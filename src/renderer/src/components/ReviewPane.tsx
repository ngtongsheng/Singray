import { useEffect, useRef, useState } from 'react'
import type { Lyrics, LyricUnit } from '../../../shared/types'

interface Props {
  lyrics: Lyrics
  /** Shared with TimingStep's transport — review plays the same original.m4a element. */
  audioRef: React.RefObject<HTMLAudioElement | null>
  onSeek: (t: number) => void
}

/** Inline review renderer (SPEC §6.7). Stub of the real player renderer — S3.2 replaces it. */
function ReviewPane({ lyrics, audioRef, onSeek }: Props): React.JSX.Element {
  const [time, setTime] = useState(0)
  const lineRefs = useRef(new Map<number, HTMLButtonElement>())

  // Full-rate clock: the wipe must track audio time exactly (SPEC §10.5), no quantizing.
  useEffect(() => {
    let raf = 0
    const loop = (): void => {
      const a = audioRef.current
      if (a) setTime(a.currentTime)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [audioRef])

  // Current line = last stamped line whose start has passed.
  let current = -1
  lyrics.lines.forEach((line, li) => {
    if (line.units.length > 0 && line.start !== null && line.start <= time) current = li
  })

  useEffect(() => {
    lineRefs.current.get(current)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-10 text-center">
      {lyrics.lines.map((line, li) =>
        line.units.length === 0 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable while reviewing
          <div key={li} className="py-2 text-text-dim/40 tracking-widest">
            · · ·
          </div>
        ) : (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable while reviewing
            key={li}
            type="button"
            ref={(el) => {
              if (el) lineRefs.current.set(li, el)
              else lineRefs.current.delete(li)
            }}
            tabIndex={-1}
            onClick={(e) => {
              if (line.start !== null) onSeek(line.start)
              e.currentTarget.blur()
            }}
            className={`block w-full py-1 font-lyric leading-snug ${
              li === current ? 'text-4xl' : 'text-xl'
            } ${li < current ? 'opacity-40' : li > current ? 'opacity-70' : ''}`}
          >
            {line.units.map((u, ui) => (
              <Unit
                // biome-ignore lint/suspicious/noArrayIndexKey: unit order is stable for a given line
                key={ui}
                unit={u}
                end={line.units[ui + 1]?.t ?? line.end}
                time={time}
              />
            ))}
          </button>
        )
      )}
    </div>
  )
}

/** Per-unit state: sung / wiping (linear gradient driven by the clock) / pending. */
function Unit({
  unit,
  end,
  time
}: {
  unit: LyricUnit
  end: number | null
  time: number
}): React.JSX.Element {
  if (unit.t === null || time < unit.t) {
    return <span className="text-lyric-pending/60">{unit.text}</span>
  }
  if (end === null || time >= end) {
    return <span className="text-lyric-sung">{unit.text}</span>
  }
  const p = ((time - unit.t) / (end - unit.t)) * 100
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(90deg, var(--color-lyric-sung) ${p}%, var(--color-lyric-active) ${p}%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent'
      }}
    >
      {unit.text}
    </span>
  )
}

export default ReviewPane
