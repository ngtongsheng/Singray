import { Heart, Mic2, Plus, Search, Settings as SettingsIcon, Type } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language, LanguageDef, SongListItem } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import ImportDialog from '../components/ImportDialog'
import SongCard from '../components/SongCard'
import Titlebar from '../components/Titlebar'
import { Button, Chip, IconButton, Input, Select } from '../components/ui'
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

/** Sing count with the legacy MVP playCount as floor (R1.5 migration). */
const singCount = (s: SongListItem): number => s.playCount + s.sings.length
const lastSungAt = (s: SongListItem): string => s.sings.at(-1) ?? s.lastPlayedAt ?? ''

interface Props {
  onOpenSettings: () => void
  onSing: (song: SongListItem) => void
}

function Library({ onOpenSettings, onSing }: Props): React.JSX.Element {
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
  const searchRef = useRef<HTMLInputElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    window.singray.settings.get().then((s) => setLangDefs(s.languages))
  }, [])

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
      return true
    })
    // 'added' keeps the listing order (addedAt desc from main)
    if (sort === 'mostSung') list.sort((a, b) => singCount(b) - singCount(a))
    else if (sort === 'recentSung') list.sort((a, b) => lastSungAt(b).localeCompare(lastSungAt(a)))
    return list
  }, [songs, query, language, favoritesOnly, needsLyricsOnly, sort])

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return
    await window.singray.library.delete(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="relative h-full">
      <Titlebar>
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
        <div className="flex-1" />
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
      </Titlebar>

      <div className="absolute inset-0 overflow-y-auto pt-19">
        <div className="flex items-center gap-2 px-6 py-3">
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
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Mic2 className="size-12 text-accent" strokeWidth={1.5} />
            <p className="text-text-dim">{t('library.emptyHint')}</p>
            <Button variant="primary" size="md" onClick={() => setShowImport(true)}>
              <Plus className="size-4" strokeWidth={2} /> {t('library.addSong')}
            </Button>
          </div>
        ) : (
          <div className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 px-6 pb-12">
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
                />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-12 text-center text-text-dim">
                {t('library.noMatch')}
              </p>
            )}
          </div>
        )}
      </div>

      {imports.size > 0 &&
        (() => {
          const activeJob = [...imports.values()].find((p) => p.stage !== 'queued')
          const job = activeJob ?? [...imports.values()][0]
          if (!job) return null
          const title = songs.find((s) => s.id === job.songId)?.title ?? job.songId
          return (
            <div className="absolute inset-x-0 bottom-0 z-20 border-border border-t bg-surface px-6 py-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-dim">
                  {STRIP_KEY[job.stage] ? t(STRIP_KEY[job.stage] as string) : job.stage} · {title}
                </span>
                <span className="font-medium text-accent">{Math.round(job.progress * 100)}%</span>
                {imports.size > 1 && (
                  <span className="text-text-dim">
                    {t('library.moreQueued', { count: imports.size - 1 })}
                  </span>
                )}
              </div>
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
