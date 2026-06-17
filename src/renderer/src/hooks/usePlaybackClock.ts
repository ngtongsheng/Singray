import { useEffect, useRef, useState } from 'react'
import type { SongListItem } from '../../../shared/types'
import type { AudioEngine } from '../lib/audioEngine'

/**
 * Play/pause state only (SPEC §7.3 sing gate lives here too): kept separate from
 * `usePlaybackPosition` so the quarter-second position tick doesn't force a
 * re-render of components that only care whether playback is on/off.
 */
export function usePlaybackClock(engine: AudioEngine | null, song: SongListItem): boolean {
  const [playing, setPlaying] = useState(false)
  const singLogged = useRef(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: song fields read from the entry snapshot
  useEffect(() => {
    if (!engine) return
    singLogged.current = false
    let raf = 0
    const loop = (): void => {
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

  return playing
}

/**
 * Coarse UI clock (quarter-second) for the seek bar / timecode, isolated into
 * its own hook so only the transport subcomponent re-renders on each tick —
 * not the whole Player tree.
 */
export function usePlaybackPosition(engine: AudioEngine | null): number {
  const [position, setPosition] = useState(0)

  useEffect(() => {
    if (!engine) return
    let raf = 0
    const loop = (): void => {
      const next = Math.round(engine.position * 4) / 4
      setPosition((prev) => (prev === next ? prev : next))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  return position
}
