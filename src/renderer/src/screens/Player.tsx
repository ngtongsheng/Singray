import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Lyrics, SongListItem } from '../../../shared/types'
import LyricRenderer from '../components/LyricRenderer'
import { AudioEngine } from '../lib/audioEngine'

interface Props {
  song: SongListItem
  onExit: () => void
}

/**
 * Karaoke player (SPEC §7). S3.2 scope: background + lyric renderer on the engine
 * clock, Space play/pause + Esc exit. Control bar chrome lands in S3.3.
 */
function Player({ song, onExit }: Props): React.JSX.Element {
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let eng: AudioEngine | null = null
    Promise.all([AudioEngine.load(song.id), window.singray.lyrics.get(song.id)])
      .then(([e, l]) => {
        if (disposed) {
          e.dispose()
          return
        }
        eng = e
        setEngine(e)
        setLyrics(l)
        e.play()
        if (import.meta.env.DEV) {
          ;(window as Window & { __playerEngine?: AudioEngine }).__playerEngine = e
        }
      })
      .catch((err: unknown) => {
        if (!disposed) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      disposed = true
      eng?.dispose()
    }
  }, [song.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onExit()
      if (e.key === ' ' && engine) {
        e.preventDefault()
        if (engine.playing) engine.pause()
        else engine.play()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine, onExit])

  const clock = useCallback(() => engine?.position ?? 0, [engine])
  const seek = useCallback((t: number) => engine?.seek(t), [engine])

  return (
    <div className="relative h-full overflow-hidden bg-bg">
      {/* Blurred artwork under a scrim + bottom fade — lyric contrast independent of art (§10.6). */}
      <img
        src={window.singray.audio.thumbUrl(song.id)}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl"
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg to-transparent" />

      <div className="absolute inset-0">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-danger">{error}</p>
            <button
              type="button"
              onClick={onExit}
              className="rounded-control border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2"
            >
              Back to library
            </button>
          </div>
        ) : !engine ? (
          <div className="flex h-full items-center justify-center gap-2 text-text-dim">
            <Loader2 className="size-5 animate-spin" /> Loading stems…
          </div>
        ) : lyrics ? (
          <LyricRenderer lyrics={lyrics} clock={clock} onSeek={seek} />
        ) : (
          <div className="flex h-full items-center justify-center text-text-dim">
            No lyrics yet — time them in the lyric creator first.
          </div>
        )}
      </div>
    </div>
  )
}

export default Player
