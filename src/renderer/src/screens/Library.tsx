import { Mic2, Plus, Settings as SettingsIcon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LanguageDef } from '../../../shared/types'
import ArtistList from '../components/ArtistList'
import ConfirmDialog from '../components/ConfirmDialog'
import FilterChips from '../components/FilterChips'
import ImportDialog from '../components/ImportDialog'
import ImportStatusStrip from '../components/ImportStatusStrip'
import SearchInput from '../components/SearchInput'
import SongGrid from '../components/SongGrid'
import SongRowList from '../components/SongRowList'
import Titlebar from '../components/Titlebar'
import { Button, Container, IconButton, Segmented, Stack } from '../components/ui'
import ViewSortControls from '../components/ViewSortControls'
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
    setSection,
    view,
    pendingDelete,
    cancelDelete,
    confirmDelete
  } = useLibraryContext()
  const [showImport, setShowImport] = useState(false)
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
            <Segmented
              className="app-no-drag"
              value={section}
              onChange={setSection}
              options={[
                { value: 'songs', label: t('library.songs') },
                { value: 'artists', label: t('library.artists') }
              ]}
            />
          </Stack>
          <Stack gap={3}>
            <Button variant="primary" onClick={() => setShowImport(true)} className="app-no-drag">
              <Plus className="size-4" strokeWidth={2} /> {t('library.addSong')}
            </Button>
            <IconButton
              onClick={goSettings}
              title={t('library.settings')}
              className="app-no-drag text-text-dim hover:text-text"
            >
              <SettingsIcon className="size-4" strokeWidth={1.5} />
            </IconButton>
          </Stack>
        </Stack>
      </Titlebar>

      <Container>
        {section === 'songs' && (
          <Stack gap={2} justify="between" className="py-3">
            <FilterChips langDefs={langDefs} />
            <ViewSortControls />
          </Stack>
        )}

        {songs.length === 0 ? (
          <Stack direction="column" gap={4} justify="center" align="center" className="py-24">
            <Mic2 className="size-12 text-accent" strokeWidth={1.5} />
            <p className="text-text-dim">{t('library.emptyHint')}</p>
            <Button variant="primary" size="md" onClick={() => setShowImport(true)}>
              <Plus className="size-4" strokeWidth={2} /> {t('library.addSong')}
            </Button>
          </Stack>
        ) : section === 'artists' ? (
          <ArtistList />
        ) : filteredSongs.length === 0 ? (
          <p className="py-12 text-center text-text-dim">{t('library.noMatch')}</p>
        ) : view === 'grid' ? (
          <SongGrid />
        ) : (
          <SongRowList />
        )}
      </Container>

      <ImportStatusStrip />

      <AnimatePresence>
        {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
        {pendingDelete && (
          <ConfirmDialog
            title={t('library.deleteTitle')}
            body={t('library.deleteBody', {
              title: pendingDelete.title,
              artist: pendingDelete.artist
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
