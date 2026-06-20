import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Lyrics, SongListItem } from '../../../shared/types'
import { type MicBootstrapState, useAudioEngine } from '../hooks/useAudioEngine'
import { useAutoHideBar } from '../hooks/useAutoHideBar'
import { usePlaybackClock } from '../hooks/usePlaybackClock'
import { useSettings } from '../hooks/useSettings'
import type { AudioEngine, MicFxPreset } from '../lib/audioEngine'
import { useAppContext } from './AppContext'

interface PlayerContextValue {
  song: SongListItem
  onExit: () => void
  onEditLyrics: (s: SongListItem) => void
  onArtistClick: (artist: string) => void

  engine: AudioEngine | null
  error: string | null
  lyrics: Lyrics | null
  clock: () => number
  seek: (t: number) => void

  playing: boolean
  togglePlay: () => void
  barVisible: boolean
  poke: () => void

  vocalOn: boolean
  toggleVocal: () => void
  vocalVol: number
  setVocalVolume: (v: number) => void

  instrVol: number
  setInstrumentalVolume: (v: number) => void

  keyVal: number
  stepKey: (delta: number) => void
  tempoVal: number
  changeTempo: (t: number) => void

  tuneOpen: boolean
  setTuneOpen: (open: boolean) => void

  pinned: boolean
  togglePin: () => void

  editOpen: boolean
  openEditMeta: () => void
  closeEditMeta: () => void
  detailsOpen: boolean
  openDetails: () => void
  closeDetails: () => void

  showWaveform: boolean
  toggleWaveform: () => void
  showBars: boolean
  toggleBars: () => void
  peaks: Float32Array | null
  analyser: AnalyserNode | null
  windowHidden: boolean

  micActive: boolean
  micMonitor: boolean
  toggleMicMonitor: () => void
  micVol: number
  setMicVolume: (v: number) => void
  micFxPreset: MicFxPreset
  micFxAmount: number
  setMicFx: (preset: MicFxPreset, amount: number) => void
  micWarning: string | null

  recording: boolean
  toggleRecord: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

interface ProviderProps {
  song: SongListItem
  children: React.ReactNode
}

/**
 * Karaoke player (SPEC §7): blurred-art stage, lyric renderer on the engine clock,
 * auto-hide control bar (§7.2). Space play/pause, V guide vocal, Esc exits.
 */
export function PlayerProvider({ song, children }: ProviderProps): React.JSX.Element {
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

  const setInstrumentalVolume = useCallback(
    (v: number) => {
      setInstrVol(v)
      engine?.setInstrumentalVolume(v)
    },
    [engine]
  )

  const setVocalVolume = useCallback(
    (v: number) => {
      setVocalVol(v)
      engine?.setVocalVolume(v)
    },
    [engine]
  )

  const toggleMicMonitor = useCallback(() => {
    setMicMonitor((prev) => {
      const next = !prev
      engine?.setMicMonitor(next)
      void patch({ micMonitor: next })
      return next
    })
  }, [engine, patch])

  const setMicVolume = useCallback(
    (v: number) => {
      setMicVol(v)
      engine?.setMicVolume(v)
      void patch({ micVolume: v })
    },
    [engine, patch]
  )

  const setMicFx = useCallback(
    (preset: MicFxPreset, amount: number) => {
      setMicFxPreset(preset)
      setMicFxAmount(amount)
      engine?.setMicFx(preset, amount)
      void patch({ micFxPreset: preset, micFxAmount: amount })
    },
    [engine, patch]
  )

  const openEditMeta = useCallback(() => setEditOpen(true), [])
  const closeEditMeta = useCallback(() => setEditOpen(false), [])
  const openDetails = useCallback(() => setDetailsOpen(true), [])
  const closeDetails = useCallback(() => setDetailsOpen(false), [])

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

  const value: PlayerContextValue = {
    song,
    onExit,
    onEditLyrics,
    onArtistClick,
    engine,
    error,
    lyrics,
    clock,
    seek,
    playing,
    togglePlay,
    barVisible,
    poke,
    vocalOn,
    toggleVocal,
    vocalVol,
    setVocalVolume,
    instrVol,
    setInstrumentalVolume,
    keyVal,
    stepKey,
    tempoVal,
    changeTempo,
    tuneOpen,
    setTuneOpen,
    pinned,
    togglePin,
    editOpen,
    openEditMeta,
    closeEditMeta,
    detailsOpen,
    openDetails,
    closeDetails,
    showWaveform,
    toggleWaveform,
    showBars,
    toggleBars,
    peaks,
    analyser,
    windowHidden,
    micActive,
    micMonitor,
    toggleMicMonitor,
    micVol,
    setMicVolume,
    micFxPreset,
    micFxAmount,
    setMicFx,
    micWarning,
    recording,
    toggleRecord
  }

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayerContext(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayerContext must be used within PlayerProvider')
  return ctx
}
