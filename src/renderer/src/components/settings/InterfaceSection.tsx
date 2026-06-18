import { useTranslation } from 'react-i18next'
import { useSettingsContext } from '../../context/SettingsContext'
import { availableLocales, i18n, localeName, resolveLocale } from '../../lib/i18n'
import { Field, Select, SettingsSection } from '../ui'

function InterfaceSection(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { settings, patch } = useSettingsContext()
  if (!settings) return null

  const setUiLanguage = (v: string): void => {
    void patch({ uiLanguage: v })
    void i18n.changeLanguage(resolveLocale(v)) // instant, no restart (R2.5)
  }

  return (
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
  )
}

export default InterfaceSection
