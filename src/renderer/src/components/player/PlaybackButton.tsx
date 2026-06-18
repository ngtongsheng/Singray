import { Pause, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerContext } from '../../context/PlayerContext'
import { IconButton } from '../ui'

function PlaybackButton(): React.JSX.Element {
  const { t } = useTranslation()
  const { playing, togglePlay } = usePlayerContext()

  return (
    <IconButton
      variant="primary"
      size="lg"
      round
      onClick={togglePlay}
      title={playing ? t('player.pauseTip') : t('player.playTip')}
    >
      {playing ? (
        <Pause className="size-5" strokeWidth={1.5} />
      ) : (
        <Play className="size-5 translate-x-0.5" strokeWidth={1.5} />
      )}
    </IconButton>
  )
}

export default PlaybackButton
