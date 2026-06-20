import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { stripIpcError } from '../../lib/stripIpcError'
import PipelineInstaller from '../shared/PipelineInstaller'
import { Button, Field, Input, Select, SettingsSection, Stack, Text } from '../ui'
import SeparationModelSelect from './SeparationModelSelect'

function PipelineSection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch, pipelineTest } = useSettingsContext()
  if (!settings) return null

  return (
    <SettingsSection title={t('settings.pipeline')}>
      <Stack direction="column" gap={4}>
        <Stack direction="column" gap={2}>
          <Text variant="hint" className="block">
            {t('settings.setup.desc')}
          </Text>
          <PipelineInstaller />
        </Stack>
        <Field label={t('settings.pythonExe')} hint={t('settings.pythonHelp')}>
          <Stack direction="column" gap={2}>
            <Stack gap={2}>
              <Input
                defaultValue={settings.pythonPath}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== settings.pythonPath)
                    patch({ pythonPath: e.target.value.trim() })
                }}
              />
              <Button
                onClick={() => pipelineTest.run()}
                disabled={pipelineTest.loading}
                className="shrink-0"
              >
                {pipelineTest.loading && <Loader2 className="size-4 animate-spin" />}
                {t('settings.testPipeline')}
              </Button>
            </Stack>
            {!pipelineTest.loading && !pipelineTest.error && pipelineTest.data && (
              <span className="flex items-center gap-1.5 text-success text-xs">
                <CheckCircle2 className="size-3.5" /> {pipelineTest.data}
              </span>
            )}
            {!pipelineTest.loading && pipelineTest.error && (
              <Text variant="error" className="flex items-center gap-1.5">
                <XCircle className="size-3.5" /> {stripIpcError(pipelineTest.error)}
              </Text>
            )}
          </Stack>
        </Field>
        <Field label={t('settings.separationModel')} hint={t('settings.separationModelHelp')}>
          <SeparationModelSelect />
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
  )
}

export default PipelineSection
