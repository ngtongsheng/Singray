import { ArrowLeft, CheckCircle2, Loader2, Plus, Volume2, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Settings as SettingsModel } from '../../../shared/types'
import PipelineInstaller from '../components/PipelineInstaller'
import Titlebar from '../components/Titlebar'
import { Button, IconButton, Input, Select } from '../components/ui'
import { availableLocales, i18n, localeName, resolveLocale } from '../lib/i18n'

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
  const { t } = useTranslation()
  const [settings, setSettings] = useState<SettingsModel | null>(null)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })
  const [llmTest, setLlmTest] = useState<TestState>({ kind: 'idle' })
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

  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const newCodeClean = newCode.trim().toLowerCase()
  const codeTaken = settings?.languages.some((l) => l.code === newCodeClean) ?? false

  const addLanguage = (): void => {
    if (!settings || !newCodeClean || !newLabel.trim() || codeTaken) return
    void patch({
      languages: [...settings.languages, { code: newCodeClean, label: newLabel.trim() }]
    })
    setNewCode('')
    setNewLabel('')
  }

  const removeLanguage = (code: string): void => {
    if (!settings) return
    void patch({ languages: settings.languages.filter((l) => l.code !== code) })
  }

  const testPipeline = async (): Promise<void> => {
    setTest({ kind: 'running' })
    const started = Date.now()
    try {
      const result = await window.singray.import.probe(TEST_URL)
      const secs = ((Date.now() - started) / 1000).toFixed(1)
      setTest({ kind: 'ok', detail: t('settings.probedIn', { title: result.title, secs }) })
    } catch (err) {
      setTest({
        kind: 'fail',
        detail: (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      })
    }
  }

  const testLlm = async (): Promise<void> => {
    setLlmTest({ kind: 'running' })
    try {
      const r = await window.singray.llm.test()
      setLlmTest({
        kind: 'ok',
        detail: t('settings.llmOk', { reply: r.reply, secs: (r.ms / 1000).toFixed(1) })
      })
    } catch (err) {
      setLlmTest({
        kind: 'fail',
        detail: (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      })
    }
  }

  const setUiLanguage = (v: string): void => {
    void patch({ uiLanguage: v })
    void i18n.changeLanguage(resolveLocale(v)) // instant, no restart (R2.5)
  }

  if (!settings) return <div className="p-6 text-text-dim">{t('common.loading')}</div>

  return (
    <div className="relative h-full">
      <Titlebar>
        <IconButton
          onClick={onBack}
          title={t('common.backEsc')}
          className="app-no-drag text-text-dim hover:text-text"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <h1 className="font-semibold text-base">{t('settings.title')}</h1>
      </Titlebar>

      <div className="absolute inset-0 overflow-y-auto px-6 pt-19 pb-6">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.interface')}</legend>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">{t('settings.uiLanguage')}</span>
              <Select
                value={settings.uiLanguage}
                onChange={setUiLanguage}
                options={[
                  { value: '', label: t('settings.followSystem') },
                  ...availableLocales.map((code) => ({ value: code, label: localeName(code) }))
                ]}
              />
              <span className="mt-1 block text-text-dim text-xs">
                {t('settings.uiLanguageHelp')}
              </span>
            </label>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.library')}</legend>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">
                {t('settings.libraryFolder')}
              </span>
              <Input
                defaultValue={settings.libraryDir}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== settings.libraryDir)
                    patch({ libraryDir: e.target.value.trim() })
                }}
              />
              <span className="mt-1 block text-text-dim text-xs">
                {t('settings.libraryFolderHelp')}
              </span>
            </label>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.languages')}</legend>
            <div className="flex flex-col gap-2">
              {settings.languages.map((l) => (
                <div
                  key={l.code}
                  className="flex items-center gap-3 rounded-control border border-border px-3 py-1.5"
                >
                  <span className="w-12 text-text-dim text-xs tabular-nums">{l.code}</span>
                  <span className="flex-1 text-sm">{l.label}</span>
                  <IconButton
                    variant="ghost"
                    size="xs"
                    onClick={() => removeLanguage(l.code)}
                    title={t('settings.remove', { label: l.label })}
                    className="text-text-dim hover:text-text"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </IconButton>
                </div>
              ))}
              <div className="flex gap-2">
                <div className="w-24">
                  <Input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="ja"
                    aria-label={t('settings.langCode')}
                  />
                </div>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addLanguage()
                  }}
                  placeholder="日本語"
                  aria-label={t('settings.langLabel')}
                />
                <Button
                  size="md"
                  onClick={addLanguage}
                  disabled={!newCodeClean || !newLabel.trim() || codeTaken}
                  title={
                    codeTaken
                      ? t('settings.codeTaken', { code: newCodeClean })
                      : t('settings.addLanguageTip')
                  }
                  className="shrink-0"
                >
                  <Plus className="size-4" strokeWidth={1.5} /> {t('settings.add')}
                </Button>
              </div>
              <span className="text-text-dim text-xs">{t('settings.languagesHelp')}</span>
            </div>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.pipeline')}</legend>
            <div className="mb-4">
              <span className="mb-2 block text-text-dim text-xs">{t('settings.setup.desc')}</span>
              <PipelineInstaller />
            </div>
            <label className="block">
              <span className="mb-1 block text-text-dim text-xs">{t('settings.pythonExe')}</span>
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
                  {t('settings.testPipeline')}
                </Button>
              </div>
              <span className="mt-1 block text-text-dim text-xs">{t('settings.pythonHelp')}</span>
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
            <label className="mt-4 block">
              <span className="mb-1 block text-text-dim text-xs">{t('settings.stemFormat')}</span>
              <Select
                value={settings.stemFormat}
                onChange={(v) => patch({ stemFormat: v as SettingsModel['stemFormat'] })}
                options={[
                  { value: 'flac', label: t('settings.stemFlac') },
                  { value: 'm4a', label: t('settings.stemM4a') }
                ]}
              />
              <span className="mt-1 block text-text-dim text-xs">
                {t('settings.stemFormatHelp')}
              </span>
            </label>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.llm')}</legend>
            <div className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1 block text-text-dim text-xs">{t('settings.llmBaseUrl')}</span>
                <Input
                  defaultValue={settings.llmBaseUrl}
                  placeholder="http://localhost:11434/v1"
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== settings.llmBaseUrl)
                      patch({ llmBaseUrl: e.target.value.trim() })
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-text-dim text-xs">{t('settings.llmModel')}</span>
                <div className="flex gap-2">
                  <Input
                    defaultValue={settings.llmModel}
                    placeholder="gemma4:12b-it-qat"
                    onBlur={(e) => {
                      if (e.target.value.trim() !== settings.llmModel)
                        patch({ llmModel: e.target.value.trim() })
                    }}
                  />
                  <Button
                    size="md"
                    onClick={testLlm}
                    disabled={llmTest.kind === 'running'}
                    title={t('settings.llmTestTip')}
                    className="shrink-0"
                  >
                    {llmTest.kind === 'running' && <Loader2 className="size-4 animate-spin" />}
                    {t('settings.test')}
                  </Button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-text-dim text-xs">{t('settings.llmApiKey')}</span>
                <Input
                  type="password"
                  defaultValue={settings.llmApiKey}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== settings.llmApiKey)
                      patch({ llmApiKey: e.target.value.trim() })
                  }}
                />
              </label>
              <span className="text-text-dim text-xs">{t('settings.llmHelp')}</span>
              {llmTest.kind === 'ok' && (
                <span className="flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="size-3.5" /> {llmTest.detail}
                </span>
              )}
              {llmTest.kind === 'fail' && (
                <span className="flex items-center gap-1.5 text-danger text-xs">
                  <XCircle className="size-3.5" /> {llmTest.detail}
                </span>
              )}
            </div>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.audio')}</legend>
            <div className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1 block text-text-dim text-xs">{t('settings.outputMode')}</span>
                <Select
                  value={settings.audioOutputMode}
                  onChange={(v) =>
                    patch({ audioOutputMode: v as SettingsModel['audioOutputMode'] })
                  }
                  options={[
                    { value: 'single', label: t('settings.modeSingle') },
                    { value: 'dual', label: t('settings.modeDual') }
                  ]}
                />
                <span className="mt-1 block text-text-dim text-xs">{t('settings.modeHelp')}</span>
              </label>

              {(['monitor', 'stream'] as const).map((which) => {
                const value =
                  which === 'monitor' ? settings.monitorDeviceId : settings.streamDeviceId
                const known = value === '' || outputs.some((d) => d.deviceId === value)
                return (
                  <label key={which} className="block">
                    <span className="mb-1 block text-text-dim text-xs">
                      {which === 'monitor'
                        ? t('settings.monitorDevice')
                        : t('settings.streamDevice')}
                    </span>
                    <div className="flex gap-2">
                      <Select
                        value={known ? value : ''}
                        disabled={settings.audioOutputMode === 'single'}
                        onChange={(v) =>
                          patch(
                            which === 'monitor' ? { monitorDeviceId: v } : { streamDeviceId: v }
                          )
                        }
                        options={[
                          { value: '', label: t('settings.systemDefault') },
                          ...outputs.map((d) => ({
                            value: d.deviceId,
                            label: d.label || t('settings.outputN', { id: d.deviceId.slice(0, 8) })
                          }))
                        ]}
                        className="flex-1"
                      />
                      <Button
                        size="md"
                        onClick={() => testTone(which)}
                        disabled={toneBusy !== null || settings.audioOutputMode === 'single'}
                        title={
                          which === 'monitor'
                            ? t('settings.toneTipMonitor')
                            : t('settings.toneTipStream')
                        }
                        className="shrink-0"
                      >
                        {toneBusy === which ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Volume2 className="size-4" strokeWidth={1.5} />
                        )}
                        {t('settings.test')}
                      </Button>
                    </div>
                    {!known && (
                      <span className="mt-1 block text-danger text-xs">
                        {t('settings.deviceMissing')}
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
