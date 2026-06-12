import {
  ArrowLeft,
  AudioWaveform,
  BarChart3,
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
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lyrics, Settings, SongListItem } from '../../../shared/types'
import EditMetaDialog from '../components/EditMetaDialog'
import LyricRenderer from '../components/LyricRenderer'
import Soundwave from '../components/Soundwave'
import StageWaveform from '../components/StageWaveform'
import Titlebar from '../components/Titlebar'
import { AudioEngine } from '../lib/audioEngine'
import { useMotionPresets } from '../lib/motionPresets'

interface Props {
  song: SongListItem
  onExit: () => void
  onEditLyrics: (song: SongListItem) => void
}

const HIDE_AFTER_MS = 3000
const TEMPO_PRESETS = [0.75, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.25]

type StageVisual = Settings['stageVisual']
const STAGE_VISUAL_NEXT: Record<StageVisual, StageVisual> = {
  off: 'waveform',
  waveform: 'bars',
  bars: 'off'
}
const STAGE_VISUAL_LABEL: Record<StageVisual, string> = {
  off: 'Stage visual: off',
  waveform: 'Stage visual: waveform',
  bars: 'Stage visual: bars'
}

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
  const [stageVisual, setStageVisual] = useState<StageVisual>('off')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const [windowHidden, setWindowHidden] = useState(document.hidden)
  const hideTimer = useRef<number>(0)
  const { popover } = useMotionPresets()

  useEffect(() => {
    let disposed = false
    let eng: AudioEngine | null = null
    Promise.all([
      window.singray.settings.get().then((s) => {
        setPinned(s.playerBarPinned)
        setStageVisual(s.stageVisual)
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
  // Also hosts the sing gate (R1.5): ≥60% accumulated playback → one timestamp per session.
  const singLogged = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: song fields read from the entry snapshot
  useEffect(() => {
    if (!engine) return
    singLogged.current = false
    let raf = 0
    const loop = (): void => {
      setPosition(Math.round(engine.position * 4) / 4)
      setPlaying(engine.playing)
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

  const cycleStageVisual = useCallback(() => {
    setStageVisual((v) => {
      const next = STAGE_VISUAL_NEXT[v]
      window.singray.settings.set({ stageVisual: next })
      return next
    })
  }, [])

  // Visual sources are per-engine (analyser dies with its context, peaks come
  // from the decoded buffers) and only built for the active mode.
  useEffect(() => {
    setAnalyser(engine && stageVisual === 'bars' ? engine.createMonitorAnalyser() : null)
    setPeaks(engine && stageVisual === 'waveform' ? engine.peaks() : null)
  }, [engine, stageVisual])

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
    <div className="flex h-full flex-col">
      <Titlebar>
        <button
          type="button"
          onClick={onExit}
          title="Back to library (Esc)"
          className="app-no-drag flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-text-dim hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </button>
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate font-semibold text-sm">{song.title}</h1>
          <p className="truncate text-text-dim text-xs">{song.artist}</p>
        </div>
        <div className="flex-1" />
        {!error && (
          <>
            <button
              type="button"
              onClick={cycleStageVisual}
              title={`${STAGE_VISUAL_LABEL[stageVisual]} — click to switch`}
              className={`app-no-drag flex h-8 items-center rounded-control px-2.5 text-sm hover:bg-surface ${
                stageVisual !== 'off' ? 'text-accent' : 'text-text-dim hover:text-text'
              }`}
            >
              {stageVisual === 'bars' ? (
                <BarChart3 className="size-4" strokeWidth={1.5} />
              ) : (
                <AudioWaveform className="size-4" strokeWidth={1.5} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              title="Edit details"
              className="app-no-drag flex h-8 items-center gap-1.5 rounded-control px-2.5 text-sm text-text-dim hover:bg-surface hover:text-text"
            >
              <Pencil className="size-4" strokeWidth={1.5} /> Edit details
            </button>
            <button
              type="button"
              onClick={() => onEditLyrics(song)}
              title={lyrics ? 'Edit lyrics' : 'Add lyrics'}
              className="app-no-drag flex h-8 items-center gap-1.5 rounded-control px-2.5 text-sm text-text-dim hover:bg-surface hover:text-text"
            >
              <Type className="size-4" strokeWidth={1.5} /> {lyrics ? 'Edit lyrics' : 'Add lyrics'}
            </button>
          </>
        )}
      </Titlebar>

      <div className={`relative flex-1 overflow-hidden bg-bg ${barVisible ? '' : 'cursor-none'}`}>
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
        {stageVisual === 'bars' && analyser && <Soundwave analyser={analyser} playing={playing} />}
        {stageVisual === 'waveform' && peaks && engine && (
          <StageWaveform peaks={peaks} duration={engine.duration} clock={clock} />
        )}

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

        <AnimatePresence>
          {editOpen && <EditMetaDialog song={song} onClose={() => setEditOpen(false)} />}
        </AnimatePresence>

        {engine && (
          // Pin/unpin slide (R2.2): bar dips and fades on auto-hide, rises on poke.
          <motion.div
            animate={barVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={
              barVisible ? { duration: 0.2, ease: 'easeOut' } : { duration: 0.14, ease: 'easeIn' }
            }
            className={`absolute inset-x-0 bottom-0 z-10 ${barVisible ? '' : 'pointer-events-none'}`}
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
                <AnimatePresence>
                  {tempoOpen && (
                    <motion.div
                      {...popover}
                      style={{ transformOrigin: 'bottom right' }}
                      className="absolute right-0 bottom-full mb-2 rounded-control border border-border bg-surface p-3 shadow-lg"
                    >
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-text-dim text-xs">Tempo</span>
                        <button
                          type="button"
                          onClick={() => changeTempo(1)}
                          className="rounded-control border border-border px-2 py-0.5 text-text-dim text-xs hover:text-text"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {TEMPO_PRESETS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={tempoVal === t}
                            onClick={() => changeTempo(t)}
                            className={`rounded-control border px-2 py-1.5 text-sm tabular-nums ${
                              tempoVal === t
                                ? 'border-accent bg-accent/15 text-accent'
                                : 'border-border text-text-dim hover:bg-surface-2 hover:text-text'
                            }`}
                          >
                            {t.toFixed(2)}×
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                  pinned
                    ? 'border-accent text-accent'
                    : 'border-border text-text-dim hover:text-text'
                }`}
              >
                {pinned ? (
                  <Pin className="size-4" strokeWidth={1.5} />
                ) : (
                  <PinOff className="size-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default Player
