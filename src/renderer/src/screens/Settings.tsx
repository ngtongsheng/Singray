import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Volume2,
  X,
  XCircle
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Settings as SettingsModel } from '../../../shared/types'
import PipelineInstaller from '../components/PipelineInstaller'
import Titlebar from '../components/Titlebar'
import { Button, Container, Field, IconButton, Input, Select, Stack, Text } from '../components/ui'
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

/** Dropdown listing available UVR separation models, with a refresh button. */
function SeparationModelSelect({
  value,
  onChange
}: {
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [models, setModels] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (force = false): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.singray.pipeline.listModels(force)
      setModels(list)
    } catch {
      setModels((prev) => prev ?? ['6_HP-Karaoke-UVR.pth'])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const valid = models?.includes(value) ?? false

  return (
    <Stack gap={2}>
      <Select
        value={valid ? value : ''}
        onChange={onChange}
        options={
          loading
            ? [{ value: '', label: t('common.loading') }]
            : [
                ...(models ?? []).map((m) => ({ value: m, label: m })),
                ...(!valid && value
                  ? [{ value, label: `${value} ${t('settings.modelCustom')}` }]
                  : [])
              ]
        }
        className="flex-1"
      />
      <IconButton
        variant="ghost"
        size="sm"
        onClick={() => load(true)}
        disabled={loading}
        title={t('settings.modelRefresh')}
        className="shrink-0 text-text-dim hover:text-text"
      >
        <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
      </IconButton>
    </Stack>
  )
}

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
        <Text as="h1" variant="title">
          {t('settings.title')}
        </Text>
      </Titlebar>

      <Container pb={6} maxWidth="xl">
        <Stack direction="column" gap={6}>
          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.interface')}</legend>
            <Field label={t('settings.uiLanguage')} hint={t('settings.uiLanguageHelp')}>
              <Select
                value={settings.uiLanguage}
                onChange={setUiLanguage}
                options={[
                  { value: '', label: t('settings.followSystem') },
                  ...availableLocales.map((code) => ({ value: code, label: localeName(code) }))
                ]}
              />
            </Field>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.library')}</legend>
            <Field label={t('settings.libraryFolder')} hint={t('settings.libraryFolderHelp')}>
              <Input
                defaultValue={settings.libraryDir}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== settings.libraryDir)
                    patch({ libraryDir: e.target.value.trim() })
                }}
              />
            </Field>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.languages')}</legend>
            <Stack direction="column" gap={2}>
              {settings.languages.map((l) => (
                <Stack
                  key={l.code}
                  gap={3}
                  className="rounded-control border border-border px-3 py-1.5"
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
                </Stack>
              ))}
              <Stack gap={2}>
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
              </Stack>
              <Text variant="hint">{t('settings.languagesHelp')}</Text>
            </Stack>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.pipeline')}</legend>
            <Stack direction="column" gap={4}>
              <div>
                <Text variant="hint" className="mb-2 block">
                  {t('settings.setup.desc')}
                </Text>
                <PipelineInstaller />
              </div>
              <Field label={t('settings.pythonExe')} hint={t('settings.pythonHelp')}>
                <Stack gap={2}>
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
                </Stack>
              </Field>
              {test.kind === 'ok' && (
                <span className="-mt-2 flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="size-3.5" /> {test.detail}
                </span>
              )}
              {test.kind === 'fail' && (
                <Text variant="error" className="-mt-2 flex items-center gap-1.5">
                  <XCircle className="size-3.5" /> {test.detail}
                </Text>
              )}
              <Field label={t('settings.separationModel')} hint={t('settings.separationModelHelp')}>
                <SeparationModelSelect
                  value={settings.separationModel || '6_HP-Karaoke-UVR.pth'}
                  onChange={(v) => patch({ separationModel: v })}
                />
              </Field>
              <Field label={t('settings.stemFormat')} hint={t('settings.stemFormatHelp')}>
                <Select
                  value={settings.stemFormat}
                  onChange={(v) => patch({ stemFormat: v as SettingsModel['stemFormat'] })}
                  options={[
                    { value: 'flac', label: t('settings.stemFlac') },
                    { value: 'm4a', label: t('settings.stemM4a') }
                  ]}
                />
              </Field>
            </Stack>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.llm')}</legend>
            <Stack direction="column" gap={4}>
              <Field label={t('settings.llmBaseUrl')}>
                <Input
                  defaultValue={settings.llmBaseUrl}
                  placeholder="http://localhost:11434/v1"
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== settings.llmBaseUrl)
                      patch({ llmBaseUrl: e.target.value.trim() })
                  }}
                />
              </Field>
              <Field label={t('settings.llmModel')}>
                <Stack gap={2}>
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
                </Stack>
              </Field>
              <Field label={t('settings.llmApiKey')}>
                <Input
                  type="password"
                  defaultValue={settings.llmApiKey}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== settings.llmApiKey)
                      patch({ llmApiKey: e.target.value.trim() })
                  }}
                />
              </Field>
              <Text variant="hint">{t('settings.llmHelp')}</Text>
              {llmTest.kind === 'ok' && (
                <span className="flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="size-3.5" /> {llmTest.detail}
                </span>
              )}
              {llmTest.kind === 'fail' && (
                <Text variant="error" className="flex items-center gap-1.5">
                  <XCircle className="size-3.5" /> {llmTest.detail}
                </Text>
              )}
            </Stack>
          </fieldset>

          <fieldset className="rounded-card border border-border p-4">
            <legend className="px-1 font-medium text-sm">{t('settings.audio')}</legend>
            <Stack direction="column" gap={4}>
              <Field label={t('settings.outputMode')} hint={t('settings.modeHelp')}>
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
              </Field>

              {(['monitor', 'stream'] as const).map((which) => {
                const value =
                  which === 'monitor' ? settings.monitorDeviceId : settings.streamDeviceId
                const known = value === '' || outputs.some((d) => d.deviceId === value)
                return (
                  <Field
                    key={which}
                    label={
                      which === 'monitor' ? t('settings.monitorDevice') : t('settings.streamDevice')
                    }
                  >
                    <Stack gap={2}>
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
                    </Stack>
                    {!known && (
                      <Text variant="error" className="mt-1 block">
                        {t('settings.deviceMissing')}
                      </Text>
                    )}
                  </Field>
                )
              })}
              {toneError && (
                <Text variant="error" className="flex items-center gap-1.5">
                  <XCircle className="size-3.5" /> {toneError}
                </Text>
              )}
            </Stack>
          </fieldset>
        </Stack>
      </Container>
    </div>
  )
}

export default Settings
