import { Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Toggle } from '../ui'

/** Only rendered when `engine.canRecord`. */
function RecordButton(): React.JSX.Element {
  const { t } = useTranslation()
  const { recording, toggleRecord } = usePlayerContext()

  return (
    <Toggle
      size="lg"
      pressed={recording}
      onClick={toggleRecord}
      title={recording ? t('player.recordStopTip') : t('player.recordStartTip')}
      className={recording ? 'text-danger' : ''}
    >
      <Circle
        className={`size-4 ${recording ? 'animate-pulse fill-danger' : ''}`}
        strokeWidth={1.5}
      />
      {recording ? t('player.recording') : t('player.record')}
    </Toggle>
  )
}

export default RecordButton
