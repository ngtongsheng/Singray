import { Mic, MicOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Toggle } from '../ui'

function VocalGuide(): React.JSX.Element {
  const { t } = useTranslation()
  const { vocalOn, toggleVocal } = usePlayerContext()

  return (
    <Toggle size="md" pressed={vocalOn} onClick={toggleVocal} title={t('player.guideTip')}>
      {vocalOn ? (
        <Mic className="size-4" strokeWidth={1.5} />
      ) : (
        <MicOff className="size-4" strokeWidth={1.5} />
      )}
      {vocalOn ? t('player.guideOn') : t('player.guideOff')}
    </Toggle>
  )
}

export default VocalGuide
