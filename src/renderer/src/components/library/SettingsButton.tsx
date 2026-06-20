import { Settings as SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppContext } from '../../context/AppContext'
import { IconButton } from '../ui'

/** Opens the Settings screen. */
function SettingsButton(): React.JSX.Element {
  const { t } = useTranslation()
  const { goSettings } = useAppContext()

  return (
    <IconButton
      onClick={goSettings}
      title={t('library.settings')}
      className="app-no-drag text-muted-foreground hover:text-foreground"
    >
      <SettingsIcon className="size-4" strokeWidth={1.5} />
    </IconButton>
  )
}

export default SettingsButton
