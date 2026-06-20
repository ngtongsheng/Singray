import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { stripIpcError } from '../../lib/stripIpcError'
import { Button, Field, IconButton, Input, SettingsSection, Stack, Text } from '../ui'
import LlmModelCombobox from './LlmModelCombobox'

function LlmSection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch, llmTest, llmModels } = useSettingsContext()
  if (!settings) return null

  return (
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
              <LlmModelCombobox />
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
  )
}

export default LlmSection
