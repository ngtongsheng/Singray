import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Volume2,
  X,
  XCircle
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PipelineInstaller from '../components/PipelineInstaller'
import Titlebar from '../components/Titlebar'
import {
  Button,
  Container,
  Field,
  IconButton,
  Input,
  Popover,
  Select,
  SettingsSection,
  Stack,
  Text,
  Toggle
} from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useAudioDevices } from '../hooks/useAudioDevices'
import { useSettings } from '../hooks/useSettings'
import { useTestTone } from '../hooks/useTestTone'
import { availableLocales, i18n, localeName, resolveLocale } from '../lib/i18n'
import { stripIpcError } from '../lib/stripIpcError'

interface Props {
  onBack: () => void
}

const TEST_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

/** Dropdown listing available UVR separation models, with a refresh button. */
function SeparationModelSelect({
  value,
  onChange
}: {
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const req = useAsync((force: boolean) => window.singray.pipeline.listModels(force))
  const { run } = req
  const loading = req.loading
  // Preserve last good list across a failed refresh; fall back only if we never loaded.
  const models = req.data ?? (req.error ? ['6_HP-Karaoke-UVR.pth'] : null)

  useEffect(() => {
    void run(false)
  }, [run])

  const valid = models?.includes(value) ?? false

  return (
    <Stack gap={2} className="w-full">
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
        variant="secondary"
        size="sm"
        onClick={() => run(true)}
        disabled={loading}
        title={t('settings.modelRefresh')}
      >
        <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
      </IconButton>
    </Stack>
  )
}

/** Editable combobox for the LLM model field: type freely or pick from the fetched list. */
function LlmModelCombobox({
  value,
  onChange,
  models
}: {
  value: string
  onChange: (v: string) => void
  models: string[]
}): React.JSX.Element {
  const [inputVal, setInputVal] = useState(value)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => setInputVal(value), [value])

  const filtered = inputVal.trim()
    ? models.filter((m) => m.toLowerCase().includes(inputVal.toLowerCase()))
    : models

  const commit = (v: string): void => {
    const trimmed = v.trim()
    if (trimmed !== value) onChange(trimmed)
    setOpen(false)
  }

  const pick = (model: string): void => {
    setInputVal(model)
    if (model !== value) onChange(model)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative flex-1">
      <Input
        value={inputVal}
        onChange={(e) => {
          setInputVal(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (models.length) setOpen(true)
        }}
        onBlur={(e) => {
          const v = e.target.value
          setTimeout(() => commit(v), 150)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter') {
            commit(inputVal)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="gemma4:12b-it-qat"
      />
      <Popover
        open={open && filtered.length > 0}
        origin="top"
        className="inset-x-0 top-full mt-1 max-h-48 overflow-y-auto py-1"
      >
        <div role="listbox">
          {filtered.map((model) => (
            <button
              key={model}
              type="button"
              role="option"
              aria-selected={model === value}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(model)
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2${model === value ? ' text-accent' : ''}`}
            >
              <span className="truncate">{model}</span>
              {model === value && <Check className="size-3.5 shrink-0" strokeWidth={2} />}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}

function Settings({ onBack }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, patch } = useSettings()
  const pipelineTest = useAsync(async () => {
    const started = Date.now()
    const result = await window.singray.import.probe(TEST_URL)
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    return t('settings.probedIn', { title: result.title, secs })
  })
  const llmTest = useAsync(async () => {
    const r = await window.singray.llm.test()
    return t('settings.llmOk', { reply: r.reply, secs: (r.ms / 1000).toFixed(1) })
  })
  const llmModels = useAsync((url: string, key: string) => window.singray.llm.listModels(url, key))
  const { outputs, inputs } = useAudioDevices()
  const { toneBusy, toneError, testTone } = useTestTone(settings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const llmBaseUrl = settings?.llmBaseUrl ?? ''
  const llmApiKey = settings?.llmApiKey ?? ''
  const { run: runLlmModels } = llmModels
  useEffect(() => {
    if (!llmBaseUrl) return
    void runLlmModels(llmBaseUrl, llmApiKey)
  }, [runLlmModels, llmBaseUrl, llmApiKey])

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
          <SettingsSection title={t('settings.interface')}>
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
          </SettingsSection>

          <SettingsSection title={t('settings.library')}>
            <Field label={t('settings.libraryFolder')} hint={t('settings.libraryFolderHelp')}>
              <Input
                defaultValue={settings.libraryDir}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== settings.libraryDir)
                    patch({ libraryDir: e.target.value.trim() })
                }}
              />
            </Field>
          </SettingsSection>

          <SettingsSection title={t('settings.languages')}>
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
          </SettingsSection>

          <SettingsSection title={t('settings.pipeline')}>
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
                    onClick={() => pipelineTest.run()}
                    disabled={pipelineTest.loading}
                    className="shrink-0"
                  >
                    {pipelineTest.loading && <Loader2 className="size-4 animate-spin" />}
                    {t('settings.testPipeline')}
                  </Button>
                </Stack>
              </Field>
              {!pipelineTest.loading && !pipelineTest.error && pipelineTest.data && (
                <span className="-mt-2 flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="size-3.5" /> {pipelineTest.data}
                </span>
              )}
              {!pipelineTest.loading && pipelineTest.error && (
                <Text variant="error" className="-mt-2 flex items-center gap-1.5">
                  <XCircle className="size-3.5" /> {stripIpcError(pipelineTest.error)}
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
                  onChange={(v) => patch({ stemFormat: v })}
                  options={[
                    { value: 'flac', label: t('settings.stemFlac') },
                    { value: 'm4a', label: t('settings.stemM4a') }
                  ]}
                />
              </Field>
            </Stack>
          </SettingsSection>

          <SettingsSection title={t('settings.llm')}>
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
                <Stack direction="column" gap={1.5}>
                  <Stack gap={2}>
                    <LlmModelCombobox
                      value={settings.llmModel}
                      onChange={(v) => patch({ llmModel: v })}
                      models={llmModels.data ?? []}
                    />
                    <IconButton
                      variant="secondary"
                      size="sm"
                      onClick={() => void llmModels.run(settings.llmBaseUrl, settings.llmApiKey)}
                      disabled={llmModels.loading}
                      title={t('settings.modelRefresh')}
                    >
                      <RefreshCw
                        className={`size-4 ${llmModels.loading ? 'animate-spin' : ''}`}
                        strokeWidth={1.5}
                      />
                    </IconButton>
                    <Button
                      size="md"
                      onClick={() => llmTest.run()}
                      disabled={llmTest.loading}
                      title={t('settings.llmTestTip')}
                      className="shrink-0"
                    >
                      {llmTest.loading && <Loader2 className="size-4 animate-spin" />}
                      {t('settings.test')}
                    </Button>
                  </Stack>
                  {!llmModels.loading && llmModels.error && (
                    <Text variant="error" className="flex items-center gap-1.5">
                      <XCircle className="size-3.5" /> {t('settings.llmModelsError')}
                    </Text>
                  )}
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
              {!llmTest.loading && !llmTest.error && llmTest.data && (
                <span className="flex items-center gap-1.5 text-success text-xs">
                  <CheckCircle2 className="size-3.5" /> {llmTest.data}
                </span>
              )}
              {!llmTest.loading && llmTest.error && (
                <Text variant="error" className="flex items-center gap-1.5">
                  <XCircle className="size-3.5" /> {stripIpcError(llmTest.error)}
                </Text>
              )}
            </Stack>
          </SettingsSection>

          <SettingsSection title={t('settings.audio')}>
            <Stack direction="column" gap={4}>
              <Field label={t('settings.outputMode')} hint={t('settings.modeHelp')}>
                <Select
                  value={settings.audioOutputMode}
                  onChange={(v) => patch({ audioOutputMode: v })}
                  options={[
                    { value: 'single', label: t('settings.modeSingle') },
                    { value: 'dual', label: t('settings.modeDual') }
                  ]}
                  className="w-full"
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
                    <Stack gap={2} className="w-full">
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
              <Field label={t('settings.recordingFormat')} hint={t('settings.recordingFormatHelp')}>
                <Select
                  value={settings.recordingFormat}
                  onChange={(v) => patch({ recordingFormat: v })}
                  options={[
                    { value: 'webm', label: t('settings.recordingWebm') },
                    { value: 'wav', label: t('settings.recordingWav') }
                  ]}
                  className="w-full"
                />
              </Field>
              {toneError && (
                <Text variant="error" className="flex items-center gap-1.5">
                  <XCircle className="size-3.5" /> {toneError}
                </Text>
              )}
              <Field label={t('settings.micDevice')} hint={t('settings.micDeviceHelp')}>
                <Stack direction="column" gap={2}>
                  <Select
                    value={settings.micDeviceId}
                    onChange={(v) => patch({ micDeviceId: v })}
                    options={[
                      { value: '', label: t('settings.systemDefault') },
                      ...inputs.map((d) => ({
                        value: d.deviceId,
                        label: d.label || t('settings.inputN', { id: d.deviceId.slice(0, 8) })
                      }))
                    ]}
                    className="w-full"
                  />
                  <Toggle
                    pressed={settings.micEnabled}
                    onClick={() => patch({ micEnabled: !settings.micEnabled })}
                    title={t('settings.micEnableHelp')}
                  >
                    {t('settings.micEnable')}
                  </Toggle>
                </Stack>
              </Field>
            </Stack>
          </SettingsSection>
        </Stack>
      </Container>
    </div>
  )
}

export default Settings
