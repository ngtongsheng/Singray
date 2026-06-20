import { Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Toggle } from '../ui'

function RecordButton(): React.JSX.Element {
  const { t } = useTranslation()
  const { engine, recording, openRecordPrep, stopRecording } = usePlayerContext()
  const canRecord = engine?.canRecord ?? false

  return (
    <Toggle
      size="md"
      pressed={recording}
      disabled={!canRecord}
      onClick={recording ? stopRecording : openRecordPrep}
      title={
        !canRecord
          ? t('player.noMicTip')
          : recording
            ? t('player.recordStopTip')
            : t('player.recordStartTip')
      }
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
