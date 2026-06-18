import {
  ArrowLeft,
  AudioWaveform,
  BarChart3,
  Circle,
  Headphones,
  Info,
  Loader2,
  Mic,
  MicOff,
  Minus,
  MoreVertical,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  SlidersHorizontal,
  Type,
  Volume2
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SongListItem } from '../../../shared/types'
import EditMetaDialog from '../components/player/EditMetaDialog'
import SongDetailsDialog from '../components/player/SongDetailsDialog'
import Soundwave from '../components/player/Soundwave'
import StageWaveform from '../components/player/StageWaveform'
import ArtistLink from '../components/shared/ArtistLink'
import LyricRenderer from '../components/shared/LyricRenderer'
import Titlebar from '../components/shared/Titlebar'
import {
  Button,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Slider,
  Stack,
  StatusStrip,
  Text,
  Toggle
} from '../components/ui'
import { useAppContext } from '../context/AppContext'
import { type MicBootstrapState, useAudioEngine } from '../hooks/useAudioEngine'
import { useAutoHideBar } from '../hooks/useAutoHideBar'
import { usePlaybackClock, usePlaybackPosition } from '../hooks/usePlaybackClock'
import { usePopoverClose } from '../hooks/usePopoverClose'
import { useSettings } from '../hooks/useSettings'
import type { AudioEngine, MicFxPreset } from '../lib/audioEngine'

interface Props {
  song: SongListItem
}

const TEMPO_PRESETS = [0.75, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.25]

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/**
 * Timecode + seek slider, isolated from Player so the quarter-second position
 * tick only re-renders this subtree, not the whole control bar.
 */
const SeekBar = memo(function SeekBar({
  engine,
  seekTip
}: {
  engine: AudioEngine
  seekTip: string
}): React.JSX.Element {
  const position = usePlaybackPosition(engine)
  return (
    <>
      <span className="text-sm text-text-dim tabular-nums">{fmt(position)}</span>
      <Slider
        min={0}
        max={engine.duration}
        step={0.25}
        value={position}
        onChange={(e) => engine.seek(Number(e.target.value))}
        title={seekTip}
        className="h-11 flex-1"
      />
      <span className="text-sm text-text-dim tabular-nums">{fmt(engine.duration)}</span>
    </>
  )
})

/**
 * Karaoke player (SPEC §7): blurred-art stage, lyric renderer on the engine clock,
 * auto-hide control bar (§7.2). Space play/pause, V guide vocal, Esc exits.
 */
function Player({ song }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { goLibrary, goCreator } = useAppContext()
  const onExit = useCallback(() => goLibrary(), [goLibrary])
  const onEditLyrics = useCallback((s: SongListItem) => goCreator(s), [goCreator])
  const onArtistClick = useCallback((artist: string) => goLibrary(artist), [goLibrary])
  const [vocalOn, setVocalOn] = useState(false)
  const [vocalVol, setVocalVol] = useState(1)
  const [instrVol, setInstrVol] = useState(1)
  const [keyVal, setKeyVal] = useState(0)
  const [tempoVal, setTempoVal] = useState(1)
  const [tuneOpen, setTuneOpen] = useState(false)
  const closeTune = useCallback(() => setTuneOpen(false), [])
  const tuneRef = usePopoverClose(tuneOpen, closeTune)
  const [pinned, setPinned] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showWaveform, setShowWaveform] = useState(false)
  const [showBars, setShowBars] = useState(false)
  const [windowHidden, setWindowHidden] = useState(document.hidden)
  const [micActive, setMicActive] = useState(false)
  const [micMonitor, setMicMonitor] = useState(true)
  const [micVol, setMicVol] = useState(1)
  const [micFxPreset, setMicFxPreset] = useState<MicFxPreset>('off')
  const [micFxAmount, setMicFxAmount] = useState(0.3)
  const [micWarning, setMicWarning] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const { settings, patch } = useSettings()

  const applyMicReady = useCallback((s: MicBootstrapState) => {
    setMicActive(s.active)
    setMicMonitor(s.monitor)
    setMicVol(s.vol)
    setMicFxPreset(s.fxPreset)
    setMicFxAmount(s.fxAmount)
    if (s.warning) setMicWarning(s.warning)
  }, [])

  const {
    state: engineState,
    lyrics,
    saveRecording
  } = useAudioEngine({
    song,
    settings,
    onMicReady: applyMicReady
  })
  const engine = engineState.status === 'ready' ? engineState.engine : null
  const error = engineState.status === 'error' ? engineState.message : null

  // Seed UI prefs from settings + reset per-song state each time we (re)load a song.
  // biome-ignore lint/correctness/useExhaustiveDependencies: settings read once per song, not on every patch
  useEffect(() => {
    if (!settings) return
    setPinned(settings.playerBarPinned)
    setShowWaveform(settings.showWaveform)
    setShowBars(settings.showBars)
    setRecording(false)
  }, [song.id, settings !== null])

  const playing = usePlaybackClock(engine, song)
  const { barVisible, poke } = useAutoHideBar(pinned)

  const togglePin = useCallback(() => {
    setPinned((p) => {
      const next = !p
      void patch({ playerBarPinned: next })
      return next
    })
  }, [patch])

  const toggleWaveform = useCallback(() => {
    setShowWaveform((v) => {
      void patch({ showWaveform: !v })
      return !v
    })
  }, [patch])

  const toggleBars = useCallback(() => {
    setShowBars((v) => {
      void patch({ showBars: !v })
      return !v
    })
  }, [patch])

  // Visual sources are per-engine (analyser dies with its context, peaks come
  // from the decoded buffers) and only built for the active mode.
  const analyser = useMemo(
    () => (engine && showBars ? engine.createMonitorAnalyser() : null),
    [engine, showBars]
  )
  const peaks = useMemo(
    () => (engine && showWaveform ? engine.peaks() : null),
    [engine, showWaveform]
  )

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

  const toggleRecord = useCallback(() => {
    if (!engine) return
    if (!engine.recording) {
      engine.startRecording()
      setRecording(true)
      return
    }
    setRecording(false)
    void engine.stopRecording().then((blob) => {
      if (blob) void saveRecording(blob)
    })
  }, [engine, saveRecording])

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
      if (editOpen || detailsOpen) return // dialog owns the keyboard (its own Escape closes it)
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
  }, [onExit, togglePlay, toggleVocal, stepKey, poke, editOpen, detailsOpen, engine])

  // Lyric clock follows what's audible: engine position minus shifter latency (§7.3).
  const clock = useCallback(() => engine?.displayPosition ?? 0, [engine])
  const seek = useCallback((t: number) => engine?.seek(t), [engine])

  return (
    <div className="relative h-full">
      <Titlebar>
        <Stack justify="between" className="w-full">
          <Stack gap={3}>
            <IconButton
              onClick={onExit}
              title={t('common.backEsc')}
              className="app-no-drag text-text-dim hover:text-text"
            >
              <ArrowLeft className="size-4" strokeWidth={1.5} />
            </IconButton>
            <Stack gap={2} justify="center" className="min-w-0">
              <Text as="h1" variant="subtitle" className="truncate">
                {song.title}
              </Text>
              <ArtistLink
                artist={song.artist}
                onClick={() => onArtistClick(song.artist)}
                className="app-no-drag shrink-0"
              />
            </Stack>
          </Stack>
          {!error && (
            <Stack gap={3}>
              <Button
                variant="secondary"
                active={showWaveform}
                onClick={toggleWaveform}
                title={t('player.stageVisual.waveform')}
                className="app-no-drag"
              >
                <AudioWaveform className="size-4" strokeWidth={1.5} />
              </Button>
              <Button
                variant="secondary"
                active={showBars}
                onClick={toggleBars}
                title={t('player.stageVisual.bars')}
                className="app-no-drag"
              >
                <BarChart3 className="size-4" strokeWidth={1.5} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditOpen(true)}
                title={t('editMeta.title')}
                className="app-no-drag"
              >
                <Pencil className="size-4" strokeWidth={1.5} /> {t('editMeta.title')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => onEditLyrics(song)}
                title={lyrics ? t('player.editLyrics') : t('player.addLyrics')}
                className="app-no-drag"
              >
                <Type className="size-4" strokeWidth={1.5} />{' '}
                {lyrics ? t('player.editLyrics') : t('player.addLyrics')}
              </Button>
              <Menu
                origin="top right"
                className="top-full right-0 translate-y-1 w-44 overflow-hidden py-1"
                trigger={(open, toggle) => (
                  <IconButton
                    variant="secondary"
                    active={open}
                    onClick={toggle}
                    title={t('player.moreActions')}
                    className="app-no-drag"
                  >
                    <MoreVertical className="size-4" strokeWidth={1.5} />
                  </IconButton>
                )}
              >
                <MenuItem onSelect={() => setDetailsOpen(true)}>
                  <Info className="size-3.5" strokeWidth={1.5} /> {t('player.songDetails')}
                </MenuItem>
              </Menu>
            </Stack>
          )}
        </Stack>
      </Titlebar>

      <div
        className={`absolute inset-0 flex flex-col overflow-hidden bg-bg ${barVisible ? '' : 'cursor-none'}`}
      >
        {/* Blurred artwork under a scrim + bottom fade — lyric contrast independent of art (§10.6). */}
        <img
          src={window.singray.audio.thumbUrl(song.id)}
          alt=""
          draggable={false}
          className={`animate-ken-burns absolute inset-0 h-full w-full object-cover blur-2xl ${
            windowHidden || !playing ? 'paused' : ''
          }`}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/3 bg-gradient-to-b from-bg to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg to-transparent" />
        {/* Spacer matching the Titlebar (top-9 = 36px + h-10 = 40px). */}
        <div
          className="h-[76px] shrink-0" /* design-allow: exact Titlebar height, no scale token matches */
        />
        {/* Waveform strip: top strip below the header. */}
        {showWaveform && peaks && engine && (
          <div className="relative z-10 h-16 shrink-0 opacity-75">
            <StageWaveform peaks={peaks} duration={engine.duration} clock={clock} />
          </div>
        )}
        {/* Bars overlay: bottom of stage, behind the control bar. */}
        {showBars && analyser && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 opacity-75">
            <Soundwave analyser={analyser} playing={playing} />
          </div>
        )}
        {/* Content area: lyrics / loading / error — fills remaining height. */}
        <div className="relative z-0 min-h-0 flex-1">
          {error ? (
            <Stack direction="column" gap={3} justify="center" align="center" className="h-full">
              <p className="text-danger">{error}</p>
              <Button size="md" onClick={onExit}>
                {t('common.back')}
              </Button>
            </Stack>
          ) : !engine ? (
            <Stack gap={2} justify="center" className="h-full text-text-dim">
              <Loader2 className="size-5 animate-spin" /> {t('player.loadingStems')}
            </Stack>
          ) : lyrics ? (
            <LyricRenderer lyrics={lyrics} clock={clock} onSeek={seek} />
          ) : (
            <Stack justify="center" className="h-full">
              <Button variant="primary" size="md" onClick={() => onEditLyrics(song)}>
                <Type className="size-4" strokeWidth={1.5} /> {t('player.addLyrics')}
              </Button>
            </Stack>
          )}
        </div>
        <AnimatePresence>
          {editOpen && <EditMetaDialog song={song} onClose={() => setEditOpen(false)} />}
          {detailsOpen && (
            <SongDetailsDialog
              song={song}
              onClose={() => setDetailsOpen(false)}
              onArtistClick={onArtistClick}
            />
          )}
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
            <Stack
              direction="column"
              gap={2}
              className="bg-gradient-to-t from-black/80 to-transparent px-6 pt-12 pb-5"
            >
              {micWarning && (
                <p className="text-xs text-danger">
                  {t('player.micWarning', { message: micWarning })}
                </p>
              )}
              <Stack gap={4} className="">
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
                <SeekBar engine={engine} seekTip={t('player.seekTip')} />

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
                    className="h-11 w-12"
                  />
                </span>

                <Stack
                  gap={2}
                  className={`h-11 rounded-control border px-2 ${
                    vocalOn ? 'border-accent' : 'border-border'
                  }`}
                >
                  <Toggle
                    variant="ghost"
                    pressed={vocalOn}
                    onClick={toggleVocal}
                    title={t('player.guideTip')}
                    className="shrink-0 whitespace-nowrap"
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
                    className="h-8 w-12"
                  />
                </Stack>

                {micActive && (
                  <Stack
                    gap={2}
                    className={`h-11 rounded-control border px-2 ${
                      micMonitor ? 'border-accent' : 'border-border'
                    }`}
                  >
                    <Toggle
                      variant="ghost"
                      pressed={micMonitor}
                      onClick={() => {
                        const next = !micMonitor
                        setMicMonitor(next)
                        engine?.setMicMonitor(next)
                        void patch({ micMonitor: next })
                      }}
                      title={t('player.micMonitorTip')}
                      className="shrink-0 whitespace-nowrap"
                    >
                      <Headphones className="size-4" strokeWidth={1.5} />
                      {micMonitor ? t('player.micMonitorOn') : t('player.micMonitorOff')}
                    </Toggle>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={micVol}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setMicVol(v)
                        engine?.setMicVolume(v)
                        void patch({ micVolume: v })
                      }}
                      title={t('player.micVolTip')}
                      className="h-8 w-12"
                    />
                  </Stack>
                )}

                {engine.canRecord && (
                  <Toggle
                    size="lg"
                    pressed={recording}
                    onClick={toggleRecord}
                    title={recording ? t('player.recordStopTip') : t('player.recordStartTip')}
                    className={recording ? 'text-danger' : ''}
                  >
                    <Circle
                      className={`size-4 ${recording ? 'animate-pulse fill-danger' : ''}`}
                      strokeWidth={1.5}
                    />
                    {recording ? t('player.recording') : t('player.record')}
                  </Toggle>
                )}

                <div className="relative" ref={tuneRef}>
                  <Popover
                    open={tuneOpen}
                    origin="bottom right"
                    className="right-0 bottom-full -translate-y-2 w-max p-3"
                  >
                    <Stack direction="column" gap={3}>
                      <Stack direction="column" gap={2}>
                        <Text as="span" variant="hint">
                          {t('player.keyLabel')}
                        </Text>
                        <Stack
                          gap={1}
                          justify="between"
                          className={`h-11 w-full rounded-control border px-2 ${
                            keyVal !== 0
                              ? 'border-accent text-accent'
                              : 'border-border text-text-dim'
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
                          <span className="whitespace-nowrap text-center text-sm tabular-nums">
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
                        </Stack>
                      </Stack>

                      <div className="h-px bg-border" />

                      <Stack direction="column" gap={2}>
                        <Stack justify="between">
                          <Text as="span" variant="hint">
                            {t('player.tempo')}
                          </Text>
                          <Button
                            size="bare"
                            onClick={() => changeTempo(1)}
                            className="px-2 py-0.5 text-text-dim text-xs hover:text-text"
                          >
                            {t('common.reset')}
                          </Button>
                        </Stack>
                        <Grid cols={4} gap={1}>
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
                        </Grid>
                      </Stack>

                      {micActive && (
                        <>
                          <div className="h-px bg-border" />
                          <Stack direction="column" gap={2}>
                            <Stack justify="between">
                              <Text as="span" variant="hint">
                                {t('player.micFxLabel')}
                              </Text>
                              <Button
                                size="bare"
                                onClick={() => {
                                  setMicFxPreset('off')
                                  engine?.setMicFx('off', micFxAmount)
                                  void patch({ micFxPreset: 'off' })
                                }}
                                className="px-2 py-0.5 text-text-dim text-xs hover:text-text"
                              >
                                {t('common.reset')}
                              </Button>
                            </Stack>
                            <Grid cols={4} gap={1}>
                              {(['room', 'hall', 'echo', 'karaoke'] as MicFxPreset[]).map((p) => (
                                <Toggle
                                  key={p}
                                  size="bare"
                                  pressed={micFxPreset === p}
                                  onClick={() => {
                                    setMicFxPreset(p)
                                    engine?.setMicFx(p, micFxAmount)
                                    void patch({ micFxPreset: p })
                                  }}
                                  className="px-2 py-1.5 text-sm"
                                >
                                  {t(`player.micPreset.${p}`)}
                                </Toggle>
                              ))}
                            </Grid>
                            {micFxPreset !== 'off' && (
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={micFxAmount}
                                onChange={(e) => {
                                  const v = Number(e.target.value)
                                  setMicFxAmount(v)
                                  engine?.setMicFx(micFxPreset, v)
                                  void patch({ micFxAmount: v })
                                }}
                                title={t('player.micFxAmountTip')}
                                className="h-8 w-full"
                              />
                            )}
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </Popover>
                  <Button
                    size="lg"
                    active={
                      tuneOpen ||
                      tempoVal !== 1 ||
                      keyVal !== 0 ||
                      (micActive && micFxPreset !== 'off')
                    }
                    onClick={() => setTuneOpen((o) => !o)}
                    aria-expanded={tuneOpen}
                    title={t('player.tuneTip')}
                    className="tabular-nums"
                  >
                    <SlidersHorizontal className="size-4" strokeWidth={1.5} />
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
              </Stack>
            </Stack>
            {micActive && micMonitor && <StatusStrip>{t('player.micLatencyHint')}</StatusStrip>}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default Player
