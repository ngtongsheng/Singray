import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LlmProvider } from '../../../../shared/types'
import { useSettingsContext } from '../../context/SettingsContext'
import { stripIpcError } from '../../lib/stripIpcError'
import { Button, Field, IconButton, Input, Select, SettingsSection, Stack, Text } from '../ui'
import LlmModelCombobox from './LlmModelCombobox'

/** Provider names are proper nouns — not translated. */
const PROVIDER_OPTIONS: { value: LlmProvider; label: string }[] = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'openrouter', label: 'OpenRouter' }
]

function LlmSection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch, llmTest, llmModels } = useSettingsContext()
  if (!settings) return null

  const provider = settings.llmProvider
  const isOllama = provider === 'ollama'

  return (
    <SettingsSection title={t('settings.llm')}>
      <Stack direction="column" gap={4}>
        <Field label={t('settings.llmProvider')}>
          <Select
            value={provider}
            onChange={(v) => patch({ llmProvider: v })}
            options={PROVIDER_OPTIONS}
          />
        </Field>
        {isOllama && (
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
        )}
        {!isOllama && (
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
        )}
        <Field label={t('settings.llmModel')}>
          <Stack direction="column" gap={1.5}>
            <Stack gap={2}>
              <LlmModelCombobox />
              <IconButton
                variant="secondary"
                size="md"
                onClick={() =>
                  void llmModels.run(provider, settings.llmBaseUrl, settings.llmApiKey)
                }
                disabled={llmModels.loading}
                title={t('settings.modelRefresh')}
              >
                <RefreshCw
                  className={`size-4 ${llmModels.loading ? 'animate-spin' : ''}`}
                  strokeWidth={1.5}
                />
              </IconButton>
              <Button
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
              <Stack direction="column" align="start" gap={1}>
                <Text variant="error" className="flex items-center gap-1.5">
                  <XCircle className="size-3.5" /> {stripIpcError(llmModels.error)}
                </Text>
                <button
                  type="button"
                  className="text-primary text-xs underline"
                  onClick={() =>
                    void llmModels.run(provider, settings.llmBaseUrl, settings.llmApiKey)
                  }
                >
                  {t('settings.modelRetry')}
                </button>
              </Stack>
            )}
          </Stack>
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
  )
}

export default LlmSection
