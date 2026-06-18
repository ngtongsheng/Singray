import { useTranslation } from 'react-i18next'
import PipelineInstaller from '../components/shared/PipelineInstaller'
import Titlebar from '../components/shared/Titlebar'
import { Button, Container, Stack, Text } from '../components/ui'

interface Props {
  /** Pipeline became ready (install finished). */
  onReady: () => void
  /** User chose to skip setup for now. */
  onSkip: () => void
}

/** First-run gate (R4.3): shown when the python/ffmpeg pipeline isn't installed. */
function PipelineSetup({ onReady, onSkip }: Props): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="relative h-full">
      <Titlebar>
        <Text as="h1" variant="title">
          {t('settings.setup.firstRunTitle')}
        </Text>
      </Titlebar>
      <Container pb={10} maxWidth="lg">
        <Stack direction="column" gap={6}>
          <p className="text-sm text-text-dim">{t('settings.setup.firstRunDesc')}</p>
          <PipelineInstaller onReady={onReady} />
          <div>
            <Button variant="ghost" size="md" onClick={onSkip}>
              {t('settings.setup.skip')}
            </Button>
          </div>
        </Stack>
      </Container>
    </div>
  )
}

export default PipelineSetup
