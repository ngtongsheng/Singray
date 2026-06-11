import {
  AudioWaveform,
  Gauge,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  Type,
  Volume2
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lyrics, SongListItem } from '../../../shared/types'
import EditMetaDialog from '../components/EditMetaDialog'
import LyricRenderer from '../components/LyricRenderer'
import Soundwave from '../components/Soundwave'
import { AudioEngine } from '../lib/audioEngine'

interface Props {
  song: SongListItem
  onExit: () => void
  onEditLyrics: (song: SongListItem) => void
}

const HIDE_AFTER_MS = 3000
const TEMPO_PRESETS = [0.75, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.25]

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/**
 * Karaoke player (SPEC §7): blurred-art stage, lyric renderer on the engine clock,
 * auto-hide control bar (§7.2). Space play/pause, V guide vocal, Esc exits.
 */
function Player({ song, onExit, onEditLyrics }: Props): React.JSX.Element {
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [vocalOn, setVocalOn] = useState(false)
  const [vocalVol, setVocalVol] = useState(1)
  const [instrVol, setInstrVol] = useState(1)
  const [position, setPosition] = useState(0)
  const [keyVal, setKeyVal] = useState(0)
  const [tempoVal, setTempoVal] = useState(1)
  const [tempoOpen, setTempoOpen] = useState(false)
  const [barVisible, setBarVisible] = useState(true)
  const [pinned, setPinned] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [waveOn, setWaveOn] = useState(false)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [windowHidden, setWindowHidden] = useState(document.hidden)
  const hideTimer = useRef<number>(0)

  // song.playCount intentionally not a dep: one increment per session, not per meta refresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    let disposed = false
    let eng: AudioEngine | null = null
    Promise.all([
      window.singray.settings.get().then((s) => {
        setPinned(s.playerBarPinned)
        setWaveOn(s.stageSoundwave)
        return AudioEngine.load(song.id, {
          mode: s.audioOutputMode,
          monitorDeviceId: s.monitorDeviceId,
          streamDeviceId: s.streamDeviceId
        })
      }),
      window.singray.lyrics.get(song.id)
    ])
      .then(([e, l]) => {
        if (disposed) {
          e.dispose()
          return
        }
        eng = e
        e.setVocal(false) // guide vocal off by default (R1.2)
        setEngine(e)
        setLyrics(l)
        if (e.routingWarning) console.warn(e.routingWarning)
        window.singray.library.updateMeta(song.id, {
          playCount: song.playCount + 1,
          lastPlayedAt: new Date().toISOString()
        })
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

  // Coarse UI clock for the seek bar / timecode (the lyric wipe runs its own full-rate rAF).
  useEffect(() => {
    if (!engine) return
    let raf = 0
    const loop = (): void => {
      setPosition(Math.round(engine.position * 4) / 4)
      setPlaying(engine.playing)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  // Pinned: bar always visible. Unpinned: any activity shows it and re-arms the 3s timer (§10.6).
  const poke = useCallback(() => {
    setBarVisible(true)
    window.clearTimeout(hideTimer.current)
    if (!pinned) hideTimer.current = window.setTimeout(() => setBarVisible(false), HIDE_AFTER_MS)
  }, [pinned])

  useEffect(() => {
    poke()
    window.addEventListener('mousemove', poke)
    return () => {
      window.removeEventListener('mousemove', poke)
      window.clearTimeout(hideTimer.current)
    }
  }, [poke])

  const togglePin = useCallback(() => {
    setPinned((p) => {
      const next = !p
      window.singray.settings.set({ playerBarPinned: next })
      return next
    })
  }, [])

  const toggleWave = useCallback(() => {
    setWaveOn((w) => {
      const next = !w
      window.singray.settings.set({ stageSoundwave: next })
      return next
    })
  }, [])

  // Analyser is per-engine (its context dies with the engine) and only built when needed.
  useEffect(() => {
    if (engine && waveOn) setAnalyser(engine.createMonitorAnalyser())
    else setAnalyser(null)
  }, [engine, waveOn])

  // Ken Burns pauses while the window is hidden.
  useEffect(() => {
    const onVis = (): void => setWindowHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const togglePlay = useCallback(() => {
    if (!engine) return
    if (engine.playing) engine.pause()
    else engine.play()
  }, [engine])

  const toggleVocal = useCallback(() => {
    if (!engine) return
    const next = !engine.vocalOn
    engine.setVocal(next)
    setVocalOn(next)
  }, [engine])

  const stepKey = useCallback(
    (delta: number) => {
      if (!engine) return
      engine.setPitchSemitones(engine.pitchSemitones + delta)
      setKeyVal(engine.pitchSemitones)
    },
    [engine]
  )

  const changeTempo = useCallback(
    (t: number) => {
      if (!engine) return
      engine.setTempo(t)
      setTempoVal(engine.tempo)
    },
    [engine]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      poke()
      if (editOpen) return // dialog owns the keyboard (its own Escape closes it)
      if (e.key === 'Escape') onExit()
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
      if (e.key === 'v' || e.key === 'V') toggleVocal()
      if (e.key === '[') stepKey(-1)
      if (e.key === ']') stepKey(1)
      if (e.key === 'ArrowLeft') engine?.seek(engine.position - 5)
      if (e.key === 'ArrowRight') engine?.seek(engine.position + 5)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, togglePlay, toggleVocal, stepKey, poke, editOpen, engine])

  // Lyric clock follows what's audible: engine position minus shifter latency (§7.3).
  const clock = useCallback(() => engine?.displayPosition ?? 0, [engine])
  const seek = useCallback((t: number) => engine?.seek(t), [engine])

  return (
    <div className={`relative h-full overflow-hidden bg-bg ${barVisible ? '' : 'cursor-none'}`}>
      {/* Blurred artwork under a scrim + bottom fade — lyric contrast independent of art (§10.6). */}
      <img
        src={window.singray.audio.thumbUrl(song.id)}
        alt=""
        draggable={false}
        className={`animate-ken-burns absolute inset-0 h-full w-full object-cover blur-3xl ${
          windowHidden ? 'paused' : ''
        }`}
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg to-transparent" />
      {waveOn && analyser && <Soundwave analyser={analyser} playing={playing} />}

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
          <div className="flex h-full items-center justify-center">
            <button
              type="button"
              onClick={() => onEditLyrics(song)}
              className="flex items-center gap-2 rounded-control bg-accent px-4 py-2 font-medium text-sm text-text hover:bg-accent-soft"
            >
              <Type className="size-4" strokeWidth={1.5} /> Add lyrics
            </button>
          </div>
        )}
      </div>

      {!error && (
        <div
          className={`absolute top-0 right-0 z-10 transition-opacity duration-200 ${
            barVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={toggleWave}
              aria-pressed={waveOn}
              title={waveOn ? 'Hide soundwave' : 'Show soundwave'}
              className={`flex items-center gap-1.5 rounded-control bg-black/50 px-3 py-1.5 text-sm hover:bg-black/70 ${
                waveOn ? 'text-accent' : 'text-text-dim hover:text-text'
              }`}
            >
              <AudioWaveform className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              title="Edit details"
              className="flex items-center gap-1.5 rounded-control bg-black/50 px-3 py-1.5 text-sm text-text-dim hover:bg-black/70 hover:text-text"
            >
              <Pencil className="size-4" strokeWidth={1.5} /> Edit details
            </button>
            <button
              type="button"
              onClick={() => onEditLyrics(song)}
              title={lyrics ? 'Edit lyrics' : 'Add lyrics'}
              className="flex items-center gap-1.5 rounded-control bg-black/50 px-3 py-1.5 text-sm text-text-dim hover:bg-black/70 hover:text-text"
            >
              <Type className="size-4" strokeWidth={1.5} /> {lyrics ? 'Edit lyrics' : 'Add lyrics'}
            </button>
          </div>
        </div>
      )}

      {editOpen && <EditMetaDialog song={song} onClose={() => setEditOpen(false)} />}

      {engine && (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 transition-opacity duration-200 ${
            barVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="flex items-center gap-4 bg-gradient-to-t from-black/80 to-transparent px-6 pt-12 pb-5">
            <button
              type="button"
              onClick={togglePlay}
              title={playing ? 'Pause (Space)' : 'Play (Space)'}
              className="flex size-11 items-center justify-center rounded-full bg-accent text-text hover:bg-accent-soft"
            >
              {playing ? (
                <Pause className="size-5" strokeWidth={1.5} />
              ) : (
                <Play className="size-5 translate-x-0.5" strokeWidth={1.5} />
              )}
            </button>
            <span className="text-sm text-text-dim tabular-nums">{fmt(position)}</span>
            <input
              type="range"
              min={0}
              max={engine.duration}
              step={0.25}
              value={position}
              onChange={(e) => engine.seek(Number(e.target.value))}
              title="Seek (←/→ ±5s)"
              className="h-11 flex-1 cursor-pointer accent-accent"
            />
            <span className="text-sm text-text-dim tabular-nums">{fmt(engine.duration)}</span>

            <span className="flex items-center gap-2 text-text-dim">
              <Volume2 className="size-4" strokeWidth={1.5} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={instrVol}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setInstrVol(v)
                  engine.setInstrumentalVolume(v)
                }}
                title="Instrumental volume"
                className="h-11 w-24 cursor-pointer accent-accent"
              />
            </span>

            <div
              className={`flex h-11 items-center gap-2 rounded-control border px-2 ${
                vocalOn ? 'border-accent' : 'border-border'
              }`}
            >
              <button
                type="button"
                onClick={toggleVocal}
                aria-pressed={vocalOn}
                title="Guide vocal (V)"
                className={`flex h-8 items-center gap-2 rounded-control px-2 text-sm ${
                  vocalOn ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                }`}
              >
                {vocalOn ? (
                  <Mic className="size-4" strokeWidth={1.5} />
                ) : (
                  <MicOff className="size-4" strokeWidth={1.5} />
                )}
                Guide {vocalOn ? 'on' : 'off'}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vocalVol}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVocalVol(v)
                  engine.setVocalVolume(v)
                }}
                title="Guide vocal volume"
                className="h-8 w-20 cursor-pointer accent-accent"
              />
            </div>

            <div
              className={`flex h-11 items-center gap-1 rounded-control border px-2 ${
                keyVal !== 0 ? 'border-accent text-accent' : 'border-border text-text-dim'
              }`}
            >
              <button
                type="button"
                onClick={() => stepKey(-1)}
                disabled={keyVal <= -6}
                title="Key down ([)"
                className="flex size-7 items-center justify-center rounded-control hover:bg-surface-2 disabled:opacity-30"
              >
                <Minus className="size-4" strokeWidth={1.5} />
              </button>
              <span className="w-14 whitespace-nowrap text-center text-sm tabular-nums">
                Key {keyVal > 0 ? `+${keyVal}` : keyVal}
              </span>
              <button
                type="button"
                onClick={() => stepKey(1)}
                disabled={keyVal >= 6}
                title="Key up (])"
                className="flex size-7 items-center justify-center rounded-control hover:bg-surface-2 disabled:opacity-30"
              >
                <Plus className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="relative">
              {tempoOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-44 rounded-control border border-border bg-surface py-2 shadow-lg">
                  <p className="px-3 pb-1 text-text-dim text-xs">Tempo</p>
                  {TEMPO_PRESETS.map((t) => (
                    <label
                      key={t}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm hover:bg-surface-2"
                    >
                      <input
                        type="radio"
                        name="tempo"
                        checked={tempoVal === t}
                        onChange={() => changeTempo(t)}
                        className="accent-accent"
                      />
                      <span className={`tabular-nums ${tempoVal === t ? 'text-accent' : ''}`}>
                        {t.toFixed(2)}×{t === 1 ? ' (normal)' : ''}
                      </span>
                    </label>
                  ))}
                  <div className="mt-1 border-border border-t px-3 pt-2">
                    <button
                      type="button"
                      onClick={() => changeTempo(1)}
                      className="rounded-control border border-border px-2 py-1 text-text-dim text-xs hover:text-text"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setTempoOpen((o) => !o)}
                aria-expanded={tempoOpen}
                title="Tempo"
                className={`flex h-11 items-center gap-2 rounded-control border px-3 text-sm tabular-nums ${
                  tempoVal !== 1
                    ? 'border-accent text-accent'
                    : 'border-border text-text-dim hover:text-text'
                }`}
              >
                <Gauge className="size-4" strokeWidth={1.5} />
                {tempoVal.toFixed(2)}×
              </button>
            </div>

            <button
              type="button"
              onClick={togglePin}
              aria-pressed={pinned}
              title={pinned ? 'Unpin bar (auto-hide)' : 'Pin bar (always visible)'}
              className={`flex h-11 items-center rounded-control border px-3 ${
                pinned ? 'border-accent text-accent' : 'border-border text-text-dim hover:text-text'
              }`}
            >
              {pinned ? (
                <Pin className="size-4" strokeWidth={1.5} />
              ) : (
                <PinOff className="size-4" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Player
