import { useEffect, useRef, useState } from 'react'
import type { SongListItem } from '../../../shared/types'
import type { AudioEngine } from '../lib/audioEngine'

interface Result {
  position: number
  playing: boolean
}

/**
 * Coarse UI clock (quarter-second) for the seek bar / timecode — the lyric
 * wipe runs its own full-rate rAF. Also hosts the sing gate (R1.5): ≥60%
 * accumulated playback logs one "sing" timestamp per session.
 */
export function usePlaybackClock(engine: AudioEngine | null, song: SongListItem): Result {
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const singLogged = useRef(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: song fields read from the entry snapshot
  useEffect(() => {
    if (!engine) return
    singLogged.current = false
    let raf = 0
    const loop = (): void => {
      const next = Math.round(engine.position * 4) / 4
      setPosition((prev) => (prev === next ? prev : next))
      setPlaying((prev) => (prev === engine.playing ? prev : engine.playing))
      if (!singLogged.current && engine.playedSeconds >= 0.6 * engine.duration) {
        singLogged.current = true
        window.singray.library.updateMeta(song.id, {
          sings: [...(song.sings ?? []), new Date().toISOString()]
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  return { position, playing }
}
