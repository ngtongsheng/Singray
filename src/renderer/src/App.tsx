import { Mic2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../../shared/types'

/**
 * Temporary S0.2 smoke-test panel: settings round-trip + karaoke:// audio
 * playback. Replaced by the library screen in S1.3.
 */
function App(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [time, setTime] = useState('—')
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    // get → set (same value) → proves the full round-trip including the file write
    window.singray.settings
      .get()
      .then((s) => window.singray.settings.set({ audioOutputMode: s.audioOutputMode }))
      .then(setSettings)
    const el = audioRef.current
    if (!el) return
    const onTime = (): void => {
      setTime(
        `${el.currentTime.toFixed(1)}s / ${Number.isFinite(el.duration) ? el.duration.toFixed(1) : '?'}s`
      )
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onTime)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onTime)
    }
  }, [])

  const toggleMode = async (): Promise<void> => {
    if (!settings) return
    const next = await window.singray.settings.set({
      audioOutputMode: settings.audioOutputMode === 'single' ? 'dual' : 'single'
    })
    setSettings(next)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Mic2 className="size-12 text-accent" strokeWidth={1.5} />
      <h1 className="font-semibold text-2xl">Singray</h1>
      <p className="text-text-dim">S0.2 smoke test</p>

      <div className="w-[560px] rounded-card border border-border bg-surface p-4">
        <pre className="select-text overflow-x-auto text-text-dim text-xs">
          {settings ? JSON.stringify(settings, null, 2) : 'loading settings…'}
        </pre>
        <button
          type="button"
          onClick={toggleMode}
          className="mt-3 rounded-control bg-accent px-4 py-2 font-medium text-sm text-text hover:bg-accent-soft"
        >
          Toggle audioOutputMode
        </button>
      </div>

      <div className="w-[560px] rounded-card border border-border bg-surface p-4">
        <p className="mb-2 text-text-dim text-xs">karaoke://test/original.m4a</p>
        {/* biome-ignore lint/a11y/useMediaCaption: instrumental test tone */}
        <audio
          ref={audioRef}
          controls
          autoPlay
          src="karaoke://test/original.m4a"
          className="w-full"
        />
        <p className="mt-2 text-sm" data-testid="audio-time">
          {time}
        </p>
      </div>
    </div>
  )
}

export default App
