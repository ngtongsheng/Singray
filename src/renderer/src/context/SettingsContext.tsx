import { createContext, useCallback, useContext, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { LlmProvider, Settings as SettingsModel } from '../../../shared/types'
import { type UseAsync, useAsync } from '../hooks/useAsync'
import { useAudioDevices } from '../hooks/useAudioDevices'
import { useSettings } from '../hooks/useSettings'
import { useTestTone } from '../hooks/useTestTone'
import { useAppContext } from './AppContext'

const TEST_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

interface SettingsContextValue {
  settings: SettingsModel | null
  patch: (p: Partial<SettingsModel>) => Promise<SettingsModel>
  onBack: () => void
  pipelineTest: UseAsync<string, []>
  llmTest: UseAsync<string, []>
  llmModels: UseAsync<string[], [provider: LlmProvider, url: string, key: string]>
  outputs: MediaDeviceInfo[]
  inputs: MediaDeviceInfo[]
  toneBusy: 'monitor' | 'stream' | null
  toneError: string | null
  testTone: (which: 'monitor' | 'stream') => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const { goLibrary } = useAppContext()
  const onBack = useCallback(() => goLibrary(), [goLibrary])
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
  const llmModels = useAsync((provider: LlmProvider, url: string, key: string) =>
    window.singray.llm.listModels(provider, url, key)
  )
  const { outputs, inputs } = useAudioDevices()
  const { toneBusy, toneError, testTone } = useTestTone(settings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const llmProvider = settings?.llmProvider ?? 'ollama'
  const llmBaseUrl = settings?.llmBaseUrl ?? ''
  const llmApiKey = settings?.llmApiKey ?? ''
  const { run: runLlmModels } = llmModels
  useEffect(() => {
    const ready = llmProvider === 'ollama' ? !!llmBaseUrl : !!llmApiKey
    if (!ready) return
    void runLlmModels(llmProvider, llmBaseUrl, llmApiKey)
  }, [runLlmModels, llmProvider, llmBaseUrl, llmApiKey])

  const value: SettingsContextValue = {
    settings,
    patch,
    onBack,
    pipelineTest,
    llmTest,
    llmModels,
    outputs,
    inputs,
    toneBusy,
    toneError,
    testTone
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider')
  return ctx
}
