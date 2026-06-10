import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Settings as SettingsModel } from '../../../shared/types'

interface Props {
  onBack: () => void
}

const TEST_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const inputClass =
  'w-full rounded-control border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-dim/60'

type TestState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; detail: string }
  | { kind: 'fail'; detail: string }

function Settings({ onBack }: Props): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsModel | null>(null)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  useEffect(() => {
    window.singray.settings.get().then(setSettings)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

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
      <header className="sticky top-0 z-10 flex items-center gap-4 border-border border-b bg-bg px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          title="Back to library"
          className="rounded-control border border-border p-1.5 hover:bg-surface"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-lg">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">Library</legend>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">Library folder</span>
              <input
                defaultValue={settings.libraryDir}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== settings.libraryDir)
                    patch({ libraryDir: e.target.value.trim() })
                }}
                className={inputClass}
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
                <input
                  defaultValue={settings.pythonPath}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== settings.pythonPath)
                      patch({ pythonPath: e.target.value.trim() })
                  }}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={testPipeline}
                  disabled={test.kind === 'running'}
                  className="flex shrink-0 items-center gap-1.5 rounded-control border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50"
                >
                  {test.kind === 'running' && <Loader2 className="size-4 animate-spin" />}
                  Test pipeline
                </button>
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
        </div>
      </div>
    </div>
  )
}

export default Settings
