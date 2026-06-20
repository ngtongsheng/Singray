import { Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Toggle } from '../ui'

/** Only rendered when `engine.canRecord`. */
function RecordButton(): React.JSX.Element {
  const { t } = useTranslation()
  const { recording, openRecordPrep, stopRecording } = usePlayerContext()

  return (
    <Toggle
      size="md"
      pressed={recording}
      onClick={recording ? stopRecording : openRecordPrep}
      title={recording ? t('player.recordStopTip') : t('player.recordStartTip')}
      className={recording ? 'text-destructive' : ''}
    >
      <Circle
        className={`size-4 ${recording ? 'animate-pulse fill-destructive' : ''}`}
        strokeWidth={1.5}
      />
      {recording ? t('player.recording') : t('player.record')}
    </Toggle>
  )
}

export default RecordButton
