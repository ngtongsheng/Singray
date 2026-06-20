import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { Select } from '../ui'

/** Strict model dropdown (issue #61): no free typing, only what `listModels` returned. */
function LlmModelCombobox(): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, patch, llmModels } = useSettingsContext()
  const value = settings?.llmModel ?? ''
  const models = llmModels.data ?? []
  const valid = models.includes(value)

  return (
    <Select
      value={value}
      onChange={(v) => {
        if (v !== value) void patch({ llmModel: v })
      }}
      disabled={llmModels.loading}
      options={
        llmModels.loading
          ? [{ value: '', label: t('common.loading') }]
          : [
              { value: '', label: t('settings.llmModelPick') },
              ...models.map((m) => ({ value: m, label: m })),
              ...(!valid && value
                ? [{ value, label: `${value} ${t('settings.modelCustom')}` }]
                : [])
            ]
      }
      className="flex-1"
    />
  )
}

export default LlmModelCombobox
