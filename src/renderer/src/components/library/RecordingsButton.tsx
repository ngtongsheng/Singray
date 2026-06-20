import { Mic2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppContext } from '../../context/AppContext'
import { IconButton } from '../ui'

function RecordingsButton(): React.JSX.Element {
  const { t } = useTranslation()
  const { goRecordings } = useAppContext()

  return (
    <IconButton
      size="md"
      onClick={() => goRecordings()}
      title={t('recordings.title')}
      className="app-no-drag text-muted-foreground hover:text-foreground"
    >
      <Mic2 className="size-4" strokeWidth={1.5} />
    </IconButton>
  )
}

export default RecordingsButton
