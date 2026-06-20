import { Headphones } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Toggle } from '../ui'

/** Mic monitor toggle — volume moved to TunePopover. Only rendered while mic is active. */
function MicMonitor(): React.JSX.Element {
  const { t } = useTranslation()
  const { micMonitor, toggleMicMonitor } = usePlayerContext()

  return (
    <Toggle
      size="md"
      pressed={micMonitor}
      onClick={toggleMicMonitor}
      title={t('player.micMonitorTip')}
    >
      <Headphones className="size-4" strokeWidth={1.5} />
      {micMonitor ? t('player.micMonitorOn') : t('player.micMonitorOff')}
    </Toggle>
  )
}

export default MicMonitor
