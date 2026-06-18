import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLibraryContext } from '../../context/LibraryContext'
import { Button, type ButtonProps } from '../ui'

/** Opens the import dialog. Reused in the Titlebar and the empty-library state. */
function AddSongButton(props: ButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const { openImport } = useLibraryContext()

  return (
    <Button variant="primary" onClick={openImport} {...props}>
      <Plus className="size-4" strokeWidth={2} /> {t('library.addSong')}
    </Button>
  )
}

export default AddSongButton
