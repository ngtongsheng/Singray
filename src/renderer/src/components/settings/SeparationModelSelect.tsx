import { RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { useAsync } from '../../hooks/useAsync'
import { IconButton, Select, Stack } from '../ui'

/** Dropdown listing available UVR separation models, with a refresh button. */
function SeparationModelSelect(): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, patch } = useSettingsContext()
  const req = useAsync((force: boolean) => window.singray.pipeline.listModels(force))
  const { run } = req
  const loading = req.loading
  // Preserve last good list across a failed refresh; fall back only if we never loaded.
  const models = req.data ?? (req.error ? ['6_HP-Karaoke-UVR.pth'] : null)

  useEffect(() => {
    void run(false)
  }, [run])

  const value = settings?.separationModel || '6_HP-Karaoke-UVR.pth'
  const valid = models?.includes(value) ?? false

  return (
    <Stack gap={2} className="w-full">
      <Select
        value={valid ? value : ''}
        onChange={(v) => patch({ separationModel: v })}
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

export default SeparationModelSelect
