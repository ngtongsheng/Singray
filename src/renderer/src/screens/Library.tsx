import { Mic2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LanguageDef } from '../../../shared/types'
import AddSongButton from '../components/library/AddSongButton'
import ArtistList from '../components/library/ArtistList'
import FilterChips from '../components/library/FilterChips'
import ImportDialog from '../components/library/ImportDialog'
import ImportStatusStrip from '../components/library/ImportStatusStrip'
import RecordingsButton from '../components/library/RecordingsButton'
import SearchInput from '../components/library/SearchInput'
import SectionSwitch from '../components/library/SectionSwitch'
import SettingsButton from '../components/library/SettingsButton'
import SongGrid from '../components/library/SongGrid'
import SongRowList from '../components/library/SongRowList'
import ViewSortControls from '../components/library/ViewSortControls'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import Titlebar from '../components/shared/Titlebar'
import { Button, ScrollArea, Stack, Text } from '../components/ui'
import { useAppContext } from '../context/AppContext'
import { LibraryProvider, useLibraryContext } from '../context/LibraryContext'

interface Props {
  /** Set when navigating from a song's artist name (ART2): pre-applies the artist filter. */
  initialArtistFilter?: string
}

function Library({ initialArtistFilter }: Props): React.JSX.Element {
  return (
    <LibraryProvider initialArtistFilter={initialArtistFilter}>
      <LibraryView />
    </LibraryProvider>
  )
}

function LibraryView(): React.JSX.Element {
  const { t } = useTranslation()
  const { goSettings } = useAppContext()
  const {
    songs,
    filteredSongs,
    section,
    view,
    pendingDelete,
    cancelDelete,
    confirmDelete,
    showImport,
    closeImport
  } = useLibraryContext()
  const [langDefs, setLangDefs] = useState<LanguageDef[]>([])

  useEffect(() => {
    window.singray.settings.get().then((s) => setLangDefs(s.languages))
  }, [])

  return (
    <div className="relative h-full">
      <Titlebar>
        <Stack justify="between" className="w-full">
          <Stack gap={3}>
            <SearchInput />
            <SectionSwitch />
          </Stack>
          <Stack gap={3}>
            <AddSongButton className="app-no-drag" />
            <RecordingsButton />
            <SettingsButton />
          </Stack>
        </Stack>
      </Titlebar>

      <div className="flex h-full flex-col pt-19">
        {section === 'songs' && (
          <Stack gap={2} justify="between" className="flex-none px-6 py-3">
            <FilterChips langDefs={langDefs} />
            <ViewSortControls />
          </Stack>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6">
            {songs.length === 0 ? (
              <Stack direction="column" gap={4} justify="center" align="center" className="py-24">
                <Mic2 className="size-12 text-primary" strokeWidth={1.5} />
                <Text variant="hint">{t('library.emptyHint')}</Text>
                <AddSongButton />
                <Text variant="hint" className="text-xs">
                  {t('library.emptyPipelineHint')}{' '}
                  <Button
                    variant="bare"
                    size="bare"
                    onClick={goSettings}
                    className="underline text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('library.emptyPipelineLink')}
                  </Button>
                </Text>
              </Stack>
            ) : section === 'artists' ? (
              <ArtistList />
            ) : filteredSongs.length === 0 ? (
              <Text variant="hint" className="py-12 text-center">
                {t('library.noMatch')}
              </Text>
            ) : view === 'grid' ? (
              <SongGrid />
            ) : (
              <SongRowList />
            )}
          </div>
        </ScrollArea>

        <ImportStatusStrip />
      </div>

      <AnimatePresence>
        {showImport && <ImportDialog onClose={closeImport} />}
        {pendingDelete && (
          <ConfirmDialog
            title={t('library.deleteTitle')}
            body={t('library.deleteBody', {
              title: pendingDelete.title,
              artist: pendingDelete.artists.join(', ')
            })}
            confirmLabel={t('common.delete')}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Library
