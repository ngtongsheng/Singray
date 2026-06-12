import { ArrowLeft, CheckCircle2, Loader2, Volume2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Settings as SettingsModel } from '../../../shared/types'
import Titlebar from '../components/Titlebar'
import { Button, IconButton, Input, Select } from '../components/ui'

/** Play a short sine tone on a specific output device ('' = system default). */
async function playTestTone(deviceId: string, freq: number): Promise<void> {
  const ctx = new AudioContext()
  try {
    if (deviceId) {
      await (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId)
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.setValueAtTime(0.25, ctx.currentTime + 0.8)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1)
    await new Promise<void>((resolve) => {
      osc.onended = () => resolve()
    })
  } finally {
    void ctx.close()
  }
}

interface Props {
  onBack: () => void
}

const TEST_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

type TestState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; detail: string }
  | { kind: 'fail'; detail: string }

function Settings({ onBack }: Props): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsModel | null>(null)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [toneBusy, setToneBusy] = useState<'monitor' | 'stream' | null>(null)
  const [toneError, setToneError] = useState<string | null>(null)

  useEffect(() => {
    window.singray.settings.get().then(setSettings)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  useEffect(() => {
    const load = (): void => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((ds) => setOutputs(ds.filter((d) => d.kind === 'audiooutput')))
    }
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [])

  const testTone = async (which: 'monitor' | 'stream'): Promise<void> => {
    if (!settings || toneBusy) return
    setToneBusy(which)
    setToneError(null)
    try {
      // Two pitches so both-at-once misrouting is obvious by ear.
      await playTestTone(
        which === 'monitor' ? settings.monitorDeviceId : settings.streamDeviceId,
        which === 'monitor' ? 440 : 660
      )
    } catch (err) {
      setToneError(err instanceof Error ? err.message : String(err))
    } finally {
      setToneBusy(null)
    }
  }

  const patch = async (p: Partial<SettingsModel>): Promise<void> => {
    setSettings(await window.singray.settings.set(p))
  }

  const testPipeline = async (): Promise<void> => {
    setTest({ kind: 'running' })
    const started = Date.now()
    try {
      const result = await window.singray.import.probe(TEST_URL)
      const secs = ((Date.now() - started) / 1000).toFixed(1)
      setTest({ kind: 'ok', detail: `Probed "${result.title}" in ${secs}s` })
    } catch (err) {
      setTest({
        kind: 'fail',
        detail: (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      })
    }
  }

  if (!settings) return <div className="p-6 text-text-dim">Loading…</div>

  return (
    <div className="flex h-full flex-col">
      <Titlebar>
        <IconButton
          onClick={onBack}
          title="Back to library (Esc)"
          className="app-no-drag text-text-dim hover:text-text"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <h1 className="font-semibold text-base">Settings</h1>
      </Titlebar>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">Library</legend>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">Library folder</span>
              <Input
                defaultValue={settings.libraryDir}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== settings.libraryDir)
                    patch({ libraryDir: e.target.value.trim() })
                }}
              />
              <span className="mt-1 block text-text-dim text-xs">
                Where downloaded songs are stored. One folder per song.
              </span>
            </label>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">Pipeline</legend>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">Python executable</span>
              <div className="flex gap-2">
                <Input
                  defaultValue={settings.pythonPath}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== settings.pythonPath)
                      patch({ pythonPath: e.target.value.trim() })
                  }}
                />
                <Button
                  size="md"
                  onClick={testPipeline}
                  disabled={test.kind === 'running'}
                  className="shrink-0"
                >
                  {test.kind === 'running' && <Loader2 className="size-4 animate-spin" />}
                  Test pipeline
                </Button>
              </div>
              <span className="mt-1 block text-text-dim text-xs">
                Python from pipeline\.venv with yt-dlp and audio-separator installed.
              </span>
              {test.kind === 'ok' && (
                <span className="mt-2 flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="size-3.5" /> {test.detail}
                </span>
              )}
              {test.kind === 'fail' && (
                <span className="mt-2 flex items-center gap-1.5 text-danger text-xs">
                  <XCircle className="size-3.5" /> {test.detail}
                </span>
              )}
            </label>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">Audio routing</legend>
            <div className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1 block text-text-dim text-xs">Output mode</span>
                <Select
                  value={settings.audioOutputMode}
                  onChange={(e) =>
                    patch({ audioOutputMode: e.target.value as SettingsModel['audioOutputMode'] })
                  }
                >
                  <option value="single">Single — everything to one device</option>
                  <option value="dual">Dual — monitor + stream mixes (Phase 4)</option>
                </Select>
                <span className="mt-1 block text-text-dim text-xs">
                  Dual sends instrumental-only to the stream device while your monitor keeps the
                  guide vocal.
                </span>
              </label>

              {(['monitor', 'stream'] as const).map((which) => {
                const value =
                  which === 'monitor' ? settings.monitorDeviceId : settings.streamDeviceId
                const known = value === '' || outputs.some((d) => d.deviceId === value)
                return (
                  <label key={which} className="block">
                    <span className="mb-1 block text-text-dim text-xs">
                      {which === 'monitor'
                        ? 'Monitor device (your headphones / AG06)'
                        : 'Stream device (virtual cable to the singing site)'}
                    </span>
                    <div className="flex gap-2">
                      <Select
                        value={known ? value : ''}
                        disabled={settings.audioOutputMode === 'single'}
                        onChange={(e) =>
                          patch(
                            which === 'monitor'
                              ? { monitorDeviceId: e.target.value }
                              : { streamDeviceId: e.target.value }
                          )
                        }
                      >
                        <option value="">System default</option>
                        {outputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Output ${d.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="md"
                        onClick={() => testTone(which)}
                        disabled={toneBusy !== null || settings.audioOutputMode === 'single'}
                        title={`Play a test tone on the ${which} device`}
                        className="shrink-0"
                      >
                        {toneBusy === which ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Volume2 className="size-4" strokeWidth={1.5} />
                        )}
                        Test
                      </Button>
                    </div>
                    {!known && (
                      <span className="mt-1 block text-danger text-xs">
                        Saved device not found — pick again (falls back to system default).
                      </span>
                    )}
                  </label>
                )
              })}
              {toneError && (
                <span className="flex items-center gap-1.5 text-danger text-xs">
                  <XCircle className="size-3.5" /> {toneError}
                </span>
              )}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  )
}

export default Settings
