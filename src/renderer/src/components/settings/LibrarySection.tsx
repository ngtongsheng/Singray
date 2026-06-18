import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { Field, Input, SettingsSection } from '../ui'

function LibrarySection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch } = useSettingsContext()
  if (!settings) return null

  return (
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
  )
}

export default LibrarySection
