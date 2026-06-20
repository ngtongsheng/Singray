import { LayoutGrid, List } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLibraryContext } from '../../context/LibraryContext'
import { Segmented, Select, Stack } from '../ui'

/** Grid/list view toggle + sort mode select. */
function ViewSortControls(): React.JSX.Element {
  const { t } = useTranslation()
  const { view, setViewMode, sort, setSort } = useLibraryContext()

  return (
    <Stack gap={2}>
      <Segmented
        className="app-no-drag"
        value={view}
        onChange={setViewMode}
        options={[
          {
            value: 'grid',
            label: <LayoutGrid className="size-4" strokeWidth={1.5} />,
            title: t('library.viewGrid')
          },
          {
            value: 'list',
            label: <List className="size-4" strokeWidth={1.5} />,
            title: t('library.viewList')
          }
        ]}
      />
      <div className="app-no-drag">
        <Select
          value={sort}
          onChange={setSort}
          title={t('library.sort')}
          options={[
            { value: 'added', label: t('library.sortAdded') },
            { value: 'mostSung', label: t('library.sortMostSung') },
            { value: 'recentSung', label: t('library.sortRecentSung') }
          ]}
        />
      </div>
    </Stack>
  )
}

export default ViewSortControls
