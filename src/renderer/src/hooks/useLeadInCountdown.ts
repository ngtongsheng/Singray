import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lyrics } from '../../../shared/types'
import type { AudioEngine } from '../lib/audioEngine'

function firstWordOnset(lyrics: Lyrics | null): number | null {
  if (!lyrics) return null
  const line = lyrics.lines.find((l) => l.units.length > 0)
  if (!line) return null
  return line.units[0]?.t ?? line.start ?? null
}

export interface LeadInCountdown {
  /** Seconds remaining to the first word, non-null only when the overlay should show. */
  remaining: number | null
  /** Play with lead-in if eligible, otherwise play immediately. */
  start: () => void
  /** Cancel a countdown that hasn't started audio yet; no-op once playing. */
  cancel: () => void
}

/**
 * Lead-in countdown to the first lyric word (#71).
 *
 * Two cases:
 *  - onset >= lead: engine.play() fires immediately; overlay appears only in
 *    the final `lead` seconds before the word (driven by engine.position).
 *  - onset < lead: delays engine.play() by (lead - onset) seconds of real-time
 *    silence; overlay runs continuously from call until the word hits 0.
 *
 * Audio silence is scheduling only — no buffer editing.
 */
export function useLeadInCountdown(
  engine: AudioEngine | null,
  lyrics: Lyrics | null,
  leadSec: number
): LeadInCountdown {
  const [remaining, setRemaining] = useState<number | null>(null)
  const rafRef = useRef(0)
  const runningRef = useRef(false)
  const onset = useMemo(() => firstWordOnset(lyrics), [lyrics])

  const stop = useCallback(() => {
    runningRef.current = false
    cancelAnimationFrame(rafRef.current)
    setRemaining(null)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: engine in deps so cleanup fires on song change
  useEffect(() => stop, [engine, stop])

  const start = useCallback(() => {
    if (!engine) return
    if (leadSec <= 0 || onset === null) {
      engine.play()
      return
    }
    runningRef.current = true
    const pad = Math.max(0, leadSec - onset)
    const wallStart = performance.now()
    let audioStarted = false
    if (pad === 0) {
      audioStarted = true
      engine.play()
    }
    const tick = (): void => {
      if (!runningRef.current) return
      if (!audioStarted) {
        const elapsed = (performance.now() - wallStart) / 1000
        if (elapsed < pad) {
          setRemaining(leadSec - elapsed)
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        audioStarted = true
        engine.play()
      }
      const rem = onset - engine.position
      if (rem <= 0) {
        stop()
        return
      }
      setRemaining(rem <= leadSec ? rem : null)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [engine, leadSec, onset, stop])

  return { remaining, start, cancel: stop }
}
