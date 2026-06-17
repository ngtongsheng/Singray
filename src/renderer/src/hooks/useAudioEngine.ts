import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lyrics, Settings, SongListItem } from '../../../shared/types'
import type { MicFxPreset } from '../lib/audioEngine'
import { AudioEngine, encodeRecordingAsWav } from '../lib/audioEngine'

export interface MicBootstrapState {
  active: boolean
  monitor: boolean
  vol: number
  fxPreset: MicFxPreset
  fxAmount: number
  warning: string | null
}

interface Options {
  song: SongListItem
  settings: Settings | null
  /** Called once synchronously after a mic-enabled-by-default load applies its
   *  FX/monitor/volume, then again once `enableMic()` resolves with the real
   *  active/warning state. Not called when the song's mic isn't enabled. */
  onMicReady: (state: MicBootstrapState) => void
}

/** Engine load status — `engine`/`error` can no longer be set simultaneously. */
export type EngineLoadState =
  | { status: 'loading' }
  | { status: 'ready'; engine: AudioEngine }
  | { status: 'error'; message: string }

interface Result {
  state: EngineLoadState
  lyrics: Lyrics | null
  setLyrics: (lyrics: Lyrics | null) => void
  saveRecording: (blob: Blob) => Promise<void>
}

/**
 * Loads the AudioEngine + lyrics for `song`, wires the recording-flush
 * callback, and applies any mic-enabled-by-default settings (MIC4). Reads
 * `settings` once per song via a ref snapshot so a later settings patch
 * (pin, stageVisual, ...) never rebuilds the engine.
 */
export function useAudioEngine({ song, settings, onMicReady }: Options): Result {
  const [state, setState] = useState<EngineLoadState>({ status: 'loading' })
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const settingsReady = settings !== null
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // R3.REC1: stream-bus take → optional WAV re-encode → IPC save under the
  // song's recordings/ folder. Used both by the record button and by a
  // mid-record exit flush (engine.onRecordingFlushed, see dispose()).
  const saveRecording = useCallback(
    async (blob: Blob) => {
      const format = settingsRef.current?.recordingFormat ?? 'webm'
      const finalBlob = format === 'wav' ? await encodeRecordingAsWav(blob) : blob
      await window.singray.recordings.save(song.id, await finalBlob.arrayBuffer(), format)
    },
    [song.id]
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: settings read once from the ref snapshot
  useEffect(() => {
    const s = settingsRef.current
    if (!s) return
    let disposed = false
    let eng: AudioEngine | null = null
    Promise.all([
      AudioEngine.load(song.id, {
        mode: s.audioOutputMode,
        monitorDeviceId: s.monitorDeviceId,
        streamDeviceId: s.streamDeviceId
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
        e.onRecordingFlushed = (blob) => {
          void saveRecording(blob)
        }
        setState({ status: 'ready', engine: e })
        setLyrics(l)
        if (e.routingWarning) console.warn(e.routingWarning)
        if (import.meta.env.DEV) {
          ;(window as Window & { __playerEngine?: AudioEngine }).__playerEngine = e
        }
        // Enable mic if configured (MIC4)
        const ms = settingsRef.current
        if (ms?.micEnabled) {
          const preset = ms.micFxPreset ?? 'off'
          const amount = ms.micFxAmount ?? 0.3
          const monitor = ms.micMonitor ?? true
          const vol = ms.micVolume ?? 1
          e.setMicFx(preset, amount)
          e.setMicMonitor(monitor)
          e.setMicVolume(vol)
          onMicReady({
            active: false,
            monitor,
            vol,
            fxPreset: preset,
            fxAmount: amount,
            warning: null
          })
          void e.enableMic(ms.micDeviceId || undefined).then(() => {
            if (!disposed) {
              onMicReady({
                active: e.micEnabled,
                monitor,
                vol,
                fxPreset: preset,
                fxAmount: amount,
                warning: e.micWarning ?? null
              })
            }
          })
        }
      })
      .catch((err: unknown) => {
        if (!disposed) {
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
        }
      })
    return () => {
      disposed = true
      eng?.dispose()
    }
  }, [song.id, settingsReady])

  return { state, lyrics, setLyrics, saveRecording }
}
