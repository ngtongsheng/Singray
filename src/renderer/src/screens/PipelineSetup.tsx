import { useTranslation } from 'react-i18next'
import PipelineInstaller from '../components/PipelineInstaller'
import Titlebar from '../components/Titlebar'
import { Button } from '../components/ui'

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
        <h1 className="font-semibold text-base">{t('settings.setup.firstRunTitle')}</h1>
      </Titlebar>
      <div className="absolute inset-0 overflow-y-auto pl-6 pr-[14px] pt-19 pb-10">
        <div className="mx-auto flex max-w-lg flex-col gap-6">
          <p className="text-sm text-text-dim">{t('settings.setup.firstRunDesc')}</p>
          <PipelineInstaller onReady={onReady} />
          <div>
            <Button variant="ghost" size="md" onClick={onSkip}>
              {t('settings.setup.skip')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PipelineSetup
