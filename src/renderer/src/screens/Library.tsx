import {
  Heart,
  LayoutGrid,
  List,
  Mic2,
  Plus,
  Search,
  Settings as SettingsIcon,
  Type,
  X
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language, LanguageDef, Settings, SongListItem } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import ImportDialog from '../components/ImportDialog'
import SongCard from '../components/SongCard'
import SongRow from '../components/SongRow'
import Titlebar from '../components/Titlebar'
import {
  Button,
  Chip,
  Container,
  Grid,
  IconButton,
  Input,
  Segmented,
  Select,
  Stack,
  Text
} from '../components/ui'
import { useImports } from '../hooks/useImports'
import { useLibrary } from '../hooks/useLibrary'
import { usePrefersReducedMotion } from '../lib/motionPresets'

const STRIP_KEY: Record<string, string> = {
  queued: 'stage.queued',
  download: 'stage.download',
  separate: 'stage.separateLong',
  convert: 'stage.convert'
}

type SortMode = 'added' | 'mostSung' | 'recentSung'
type Section = 'songs' | 'artists'
type ViewMode = Settings['libraryView']

/** Sing count with the legacy MVP playCount as floor (R1.5 migration). */
const singCount = (s: SongListItem): number => s.playCount + s.sings.length
const lastSungAt = (s: SongListItem): string => s.sings.at(-1) ?? s.lastPlayedAt ?? ''

interface Props {
  onOpenSettings: () => void
  onSing: (song: SongListItem) => void
  /** Set when navigating from a song's artist name (ART2): pre-applies the artist filter. */
  initialArtistFilter?: string
}

function Library({ onOpenSettings, onSing, initialArtistFilter }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { songs } = useLibrary()
  const imports = useImports()
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<Language | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [needsLyricsOnly, setNeedsLyricsOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('added')
  const [pendingDelete, setPendingDelete] = useState<SongListItem | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [langDefs, setLangDefs] = useState<LanguageDef[]>([])
  const [section, setSection] = useState<Section>('songs')
  const [view, setView] = useState<ViewMode>('grid')
  const [artistFilter, setArtistFilter] = useState<string | null>(initialArtistFilter ?? null)
  const searchRef = useRef<HTMLInputElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    window.singray.settings.get().then((s) => {
      setLangDefs(s.languages)
      setView(s.libraryView)
    })
  }, [])

  // ART2: navigating in from a song's artist name re-applies the filter even
  // though Library stays mounted (App.tsx key is constant).
  useEffect(() => {
    if (initialArtistFilter === undefined) return
    setArtistFilter(initialArtistFilter.trim())
    setSection('songs')
  }, [initialArtistFilter])

  const setViewMode = (v: ViewMode): void => {
    setView(v)
    void window.singray.settings.set({ libraryView: v })
  }

  const onArtistClick = (artist: string): void => {
    setArtistFilter(artist.trim())
    setSection('songs')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Filter chips (R2.4): settings languages first, then any extra codes still on
  // songs (e.g. a removed language) so every song stays filterable.
  const languages = useMemo(
    () => [...new Set([...langDefs.map((l) => l.code), ...songs.map((s) => s.language)])],
    [langDefs, songs]
  )
  const langLabel = (code: Language): string =>
    langDefs.find((l) => l.code === code)?.label ??
    (code === 'unknown' ? t('common.unknown') : code)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = songs.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q) && !s.artist.toLowerCase().includes(q))
        return false
      if (language && s.language !== language) return false
      if (favoritesOnly && !s.favorite) return false
      if (needsLyricsOnly && s.hasLyrics) return false
      if (artistFilter !== null && s.artist.trim() !== artistFilter) return false
      return true
    })
    // 'added' keeps the listing order (addedAt desc from main)
    if (sort === 'mostSung') list.sort((a, b) => singCount(b) - singCount(a))
    else if (sort === 'recentSung') list.sort((a, b) => lastSungAt(b).localeCompare(lastSungAt(a)))
    return list
  }, [songs, query, language, favoritesOnly, needsLyricsOnly, artistFilter, sort])

  // ART1: every distinct artist with a song count, "" groups songs with no artist set.
  const artists = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of songs) {
      const name = s.artist.trim()
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name || '￿').localeCompare(b.name || '￿', undefined, { numeric: true }))
  }, [songs])

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return
    await window.singray.library.delete(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="relative h-full">
      <Titlebar>
        <Stack justify="between" className="w-full">
          <Stack gap={3}>
            <div className="app-no-drag w-72">
              <Input
                ref={searchRef}
                uiSize="sm"
                icon={<Search className="size-4 text-text-dim" />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('library.searchPlaceholder')}
              />
            </div>
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
            {section === 'songs' && (
              <>
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
                    uiSize="sm"
                    value={sort}
                    onChange={(v) => setSort(v as SortMode)}
                    title={t('library.sort')}
                    options={[
                      { value: 'added', label: t('library.sortAdded') },
                      { value: 'mostSung', label: t('library.sortMostSung') },
                      { value: 'recentSung', label: t('library.sortRecentSung') }
                    ]}
                  />
                </div>
              </>
            )}
            <Button variant="primary" onClick={() => setShowImport(true)} className="app-no-drag">
              <Plus className="size-4" strokeWidth={2} /> {t('library.addSong')}
            </Button>
            <IconButton
              onClick={onOpenSettings}
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
          <Stack gap={2} className="py-3">
            {artistFilter !== null && (
              <Chip
                active
                onClick={() => setArtistFilter(null)}
                title={t('library.clearArtistFilter')}
              >
                {t('library.artistFilter', { name: artistFilter || t('common.unknown') })}
                <X className="size-3.5" strokeWidth={1.5} />
              </Chip>
            )}
            {languages.map((lang) => (
              <Chip
                key={lang}
                active={language === lang}
                onClick={() => setLanguage(language === lang ? null : lang)}
              >
                {langLabel(lang)}
              </Chip>
            ))}
            <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
              <Heart className="size-3.5" strokeWidth={1.5} /> {t('library.favorites')}
            </Chip>
            <Chip active={needsLyricsOnly} onClick={() => setNeedsLyricsOnly(!needsLyricsOnly)}>
              <Type className="size-3.5" strokeWidth={1.5} /> {t('library.needsLyrics')}
            </Chip>
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
          <Stack direction="column" gap={2} className="pb-12">
            {artists.map(({ name, count }) => (
              <button
                key={name}
                type="button"
                onClick={() => onArtistClick(name)}
                className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-text-dim/40"
              >
                <Text as="span" variant="item">
                  {name || t('common.unknown')}
                </Text>
                <Text as="span" variant="hint" className="shrink-0">
                  {t('library.songCount', { count })}
                </Text>
              </button>
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-text-dim">{t('library.noMatch')}</p>
        ) : view === 'grid' ? (
          <Grid minItemWidth={220} autoRows="min" gap={4} className="pb-12">
            {filtered.map((song, i) => (
              // Entrance stagger (SPEC §10.5): 30ms per card, capped, animates once per mount.
              <motion.div
                key={song.id}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i * 0.03, 0.45) }}
              >
                <SongCard
                  song={song}
                  importing={imports.get(song.id)}
                  onDelete={setPendingDelete}
                  onSing={onSing}
                  onArtistClick={onArtistClick}
                />
              </motion.div>
            ))}
          </Grid>
        ) : (
          <Stack direction="column" gap={2} className="pb-12">
            {filtered.map((song, i) => (
              // Entrance stagger (SPEC §10.5): 30ms per card, capped, animates once per mount.
              <motion.div
                key={song.id}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i * 0.03, 0.45) }}
              >
                <SongRow
                  song={song}
                  importing={imports.get(song.id)}
                  onDelete={setPendingDelete}
                  onSing={onSing}
                  onArtistClick={onArtistClick}
                />
              </motion.div>
            ))}
          </Stack>
        )}
      </Container>

      {imports.size > 0 &&
        (() => {
          const activeJob = [...imports.values()].find((p) => p.stage !== 'queued')
          const job = activeJob ?? [...imports.values()][0]
          if (!job) return null
          const title = songs.find((s) => s.id === job.songId)?.title ?? job.songId
          return (
            <div className="absolute inset-x-0 bottom-0 z-20 border-border border-t bg-surface px-6 py-1.5">
              <Stack gap={2} className="text-xs">
                <span className="text-text-dim">
                  {STRIP_KEY[job.stage] ? t(STRIP_KEY[job.stage] as string) : job.stage} · {title}
                </span>
                <span className="font-medium text-accent">{Math.round(job.progress * 100)}%</span>
                {imports.size > 1 && (
                  <span className="text-text-dim">
                    {t('library.moreQueued', { count: imports.size - 1 })}
                  </span>
                )}
              </Stack>
              <div
                className="absolute top-0 left-0 h-0.5 bg-accent transition-[width] duration-300"
                style={{ width: `${job.progress * 100}%` }}
              />
            </div>
          )
        })()}

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
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Library
