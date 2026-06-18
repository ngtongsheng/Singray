import { Pin, PinOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { Toggle } from '../ui'

function PinToggle(): React.JSX.Element {
  const { t } = useTranslation()
  const { pinned, togglePin } = usePlayerContext()

  return (
    <Toggle
      size="lg"
      pressed={pinned}
      onClick={togglePin}
      title={pinned ? t('player.unpinTip') : t('player.pinTip')}
    >
      {pinned ? (
        <Pin className="size-4" strokeWidth={1.5} />
      ) : (
        <PinOff className="size-4" strokeWidth={1.5} />
      )}
    </Toggle>
  )
}

export default PinToggle
