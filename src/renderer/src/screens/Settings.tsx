import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AudioSection from '../components/settings/AudioSection'
import InterfaceSection from '../components/settings/InterfaceSection'
import LanguagesSection from '../components/settings/LanguagesSection'
import LibrarySection from '../components/settings/LibrarySection'
import LlmSection from '../components/settings/LlmSection'
import PipelineSection from '../components/settings/PipelineSection'
import Titlebar from '../components/shared/Titlebar'
import { Container, IconButton, Stack, Text } from '../components/ui'
import { SettingsProvider, useSettingsContext } from '../context/SettingsContext'

function Settings(): React.JSX.Element {
  return (
    <SettingsProvider>
      <SettingsView />
    </SettingsProvider>
  )
}

function SettingsView(): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, onBack } = useSettingsContext()

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
          <InterfaceSection />
          <LibrarySection />
          <LanguagesSection />
          <PipelineSection />
          <LlmSection />
          <AudioSection />
        </Stack>
      </Container>
    </div>
  )
}

export default Settings
