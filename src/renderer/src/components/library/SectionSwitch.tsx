import { useTranslation } from 'react-i18next'
import { useLibraryContext } from '../../context/LibraryContext'
import { Segmented } from '../ui'

/** Songs/Artists section toggle. */
function SectionSwitch(): React.JSX.Element {
  const { t } = useTranslation()
  const { section, setSection } = useLibraryContext()

  return (
    <Segmented
      className="app-no-drag"
      value={section}
      onChange={setSection}
      options={[
        { value: 'songs', label: t('library.songs') },
        { value: 'artists', label: t('library.artists') }
      ]}
    />
  )
}

export default SectionSwitch
