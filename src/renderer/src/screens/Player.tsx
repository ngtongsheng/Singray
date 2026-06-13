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
import { useTranslation } from 'react-i18next'
import type { Lyrics, Settings, SongListItem } from '../../../shared/types'
import EditMetaDialog from '../components/EditMetaDialog'
import LyricRenderer from '../components/LyricRenderer'
import Soundwave from '../components/Soundwave'
import StageWaveform from '../components/StageWaveform'
import Titlebar from '../components/Titlebar'
import { Button, IconButton, Popover, Slider, Toggle } from '../components/ui'
import { AudioEngine } from '../lib/audioEngine'

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
const STAGE_VISUAL_KEY: Record<StageVisual, string> = {
  off: 'player.stageVisual.off',
  waveform: 'player.stageVisual.waveform',
  bars: 'player.stageVisual.bars'
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
  const { t } = useTranslation()
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
    <div className="relative h-full">
      <Titlebar>
        <IconButton
          onClick={onExit}
          title={t('common.backEsc')}
          className="app-no-drag text-text-dim hover:text-text"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate font-semibold text-sm">{song.title}</h1>
          <p className="truncate text-text-dim text-xs">{song.artist}</p>
        </div>
        <div className="flex-1" />
        {!error && (
          <>
            <Button
              variant="ghost"
              active={stageVisual !== 'off'}
              onClick={cycleStageVisual}
              title={t('player.stageVisualTip', { mode: t(STAGE_VISUAL_KEY[stageVisual]) })}
              className="app-no-drag"
            >
              {stageVisual === 'bars' ? (
                <BarChart3 className="size-4" strokeWidth={1.5} />
              ) : (
                <AudioWaveform className="size-4" strokeWidth={1.5} />
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setEditOpen(true)}
              title={t('editMeta.title')}
              className="app-no-drag text-text-dim hover:text-text"
            >
              <Pencil className="size-4" strokeWidth={1.5} /> {t('editMeta.title')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onEditLyrics(song)}
              title={lyrics ? t('player.editLyrics') : t('player.addLyrics')}
              className="app-no-drag text-text-dim hover:text-text"
            >
              <Type className="size-4" strokeWidth={1.5} />{' '}
              {lyrics ? t('player.editLyrics') : t('player.addLyrics')}
            </Button>
          </>
        )}
      </Titlebar>

      <div className={`absolute inset-0 overflow-hidden bg-bg ${barVisible ? '' : 'cursor-none'}`}>
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
              <Button size="md" onClick={onExit}>
                {t('common.back')}
              </Button>
            </div>
          ) : !engine ? (
            <div className="flex h-full items-center justify-center gap-2 text-text-dim">
              <Loader2 className="size-5 animate-spin" /> {t('player.loadingStems')}
            </div>
          ) : lyrics ? (
            <LyricRenderer lyrics={lyrics} clock={clock} onSeek={seek} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Button variant="primary" size="md" onClick={() => onEditLyrics(song)}>
                <Type className="size-4" strokeWidth={1.5} /> {t('player.addLyrics')}
              </Button>
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
              <IconButton
                variant="primary"
                size="lg"
                round
                onClick={togglePlay}
                title={playing ? t('player.pauseTip') : t('player.playTip')}
              >
                {playing ? (
                  <Pause className="size-5" strokeWidth={1.5} />
                ) : (
                  <Play className="size-5 translate-x-0.5" strokeWidth={1.5} />
                )}
              </IconButton>
              <span className="text-sm text-text-dim tabular-nums">{fmt(position)}</span>
              <Slider
                min={0}
                max={engine.duration}
                step={0.25}
                value={position}
                onChange={(e) => engine.seek(Number(e.target.value))}
                title={t('player.seekTip')}
                className="h-11 flex-1"
              />
              <span className="text-sm text-text-dim tabular-nums">{fmt(engine.duration)}</span>

              <span className="flex items-center gap-2 text-text-dim">
                <Volume2 className="size-4" strokeWidth={1.5} />
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={instrVol}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setInstrVol(v)
                    engine.setInstrumentalVolume(v)
                  }}
                  title={t('player.instrVolTip')}
                  className="h-11 w-24"
                />
              </span>

              <div
                className={`flex h-11 items-center gap-2 rounded-control border px-2 ${
                  vocalOn ? 'border-accent' : 'border-border'
                }`}
              >
                <Toggle
                  variant="ghost"
                  pressed={vocalOn}
                  onClick={toggleVocal}
                  title={t('player.guideTip')}
                >
                  {vocalOn ? (
                    <Mic className="size-4" strokeWidth={1.5} />
                  ) : (
                    <MicOff className="size-4" strokeWidth={1.5} />
                  )}
                  {vocalOn ? t('player.guideOn') : t('player.guideOff')}
                </Toggle>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={vocalVol}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setVocalVol(v)
                    engine.setVocalVolume(v)
                  }}
                  title={t('player.guideVolTip')}
                  className="h-8 w-20"
                />
              </div>

              <div
                className={`flex h-11 items-center gap-1 rounded-control border px-2 ${
                  keyVal !== 0 ? 'border-accent text-accent' : 'border-border text-text-dim'
                }`}
              >
                <IconButton
                  variant="ghost"
                  size="xs"
                  onClick={() => stepKey(-1)}
                  disabled={keyVal <= -6}
                  title={t('player.keyDownTip')}
                >
                  <Minus className="size-4" strokeWidth={1.5} />
                </IconButton>
                <span className="w-14 whitespace-nowrap text-center text-sm tabular-nums">
                  {t('player.key', { value: keyVal > 0 ? `+${keyVal}` : keyVal })}
                </span>
                <IconButton
                  variant="ghost"
                  size="xs"
                  onClick={() => stepKey(1)}
                  disabled={keyVal >= 6}
                  title={t('player.keyUpTip')}
                >
                  <Plus className="size-4" strokeWidth={1.5} />
                </IconButton>
              </div>

              <div className="relative">
                <Popover
                  open={tempoOpen}
                  origin="bottom right"
                  className="right-0 bottom-full mb-2 w-max p-3"
                >
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-text-dim text-xs">{t('player.tempo')}</span>
                    <Button
                      size="bare"
                      onClick={() => changeTempo(1)}
                      className="px-2 py-0.5 text-text-dim text-xs hover:text-text"
                    >
                      {t('common.reset')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {TEMPO_PRESETS.map((t) => (
                      <Toggle
                        key={t}
                        size="bare"
                        pressed={tempoVal === t}
                        onClick={() => changeTempo(t)}
                        className="px-2 py-1.5 text-sm tabular-nums"
                      >
                        {t.toFixed(2)}×
                      </Toggle>
                    ))}
                  </div>
                </Popover>
                <Button
                  size="lg"
                  active={tempoVal !== 1}
                  onClick={() => setTempoOpen((o) => !o)}
                  aria-expanded={tempoOpen}
                  title={t('player.tempo')}
                  className="tabular-nums"
                >
                  <Gauge className="size-4" strokeWidth={1.5} />
                  {tempoVal.toFixed(2)}×
                </Button>
              </div>

              <Toggle
                size="lg"
                pressed={pinned}
                onClick={togglePin}
                title={pinned ? t('player.unpinTip') : t('player.pinTip')}
              >
                {pinned ? (
                  <Pin className="size-4" strokeWidth={1.5} />
                ) : (
                  <PinOff className="size-4" strokeWidth={1.5} />
                )}
              </Toggle>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default Player
