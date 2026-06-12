import { Heart, Mic2, Plus, Search, Settings as SettingsIcon, Type } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language, SongListItem } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import ImportDialog from '../components/ImportDialog'
import SongCard from '../components/SongCard'
import Titlebar from '../components/Titlebar'
import { Button, Chip, IconButton, Input, Select } from '../components/ui'
import { useImports } from '../hooks/useImports'
import { useLibrary } from '../hooks/useLibrary'
import { usePrefersReducedMotion } from '../lib/motionPresets'

const LANGUAGE_LABEL: Record<Language, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  unknown: 'Unknown'
}

const STRIP_LABEL: Record<string, string> = {
  queued: 'Queued',
  download: 'Downloading',
  separate: 'Separating vocals',
  convert: 'Converting'
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
  const { songs } = useLibrary()
  const imports = useImports()
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<Language | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [needsLyricsOnly, setNeedsLyricsOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('added')
  const [pendingDelete, setPendingDelete] = useState<SongListItem | null>(null)
  const [showImport, setShowImport] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const reduced = usePrefersReducedMotion()

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

  const languages = useMemo(() => [...new Set(songs.map((s) => s.language))], [songs])

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
    <div className="flex h-full flex-col">
      <Titlebar>
        <h1 className="font-semibold text-base">Singray</h1>
        <div className="app-no-drag ml-2 w-72">
          <Input
            ref={searchRef}
            uiSize="sm"
            icon={<Search className="size-4 text-text-dim" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or artist  ( / )"
          />
        </div>
        <div className="flex-1" />
        <Button variant="primary" onClick={() => setShowImport(true)} className="app-no-drag">
          <Plus className="size-4" strokeWidth={2} /> Add Song
        </Button>
        <IconButton
          onClick={onOpenSettings}
          title="Settings"
          className="app-no-drag text-text-dim hover:text-text"
        >
          <SettingsIcon className="size-4" strokeWidth={1.5} />
        </IconButton>
      </Titlebar>

      <div className="flex items-center gap-2 px-6 py-3">
        {languages.map((lang) => (
          <Chip
            key={lang}
            active={language === lang}
            onClick={() => setLanguage(language === lang ? null : lang)}
          >
            {LANGUAGE_LABEL[lang]}
          </Chip>
        ))}
        <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
          <Heart className="size-3.5" strokeWidth={1.5} /> Favorites
        </Chip>
        <Chip active={needsLyricsOnly} onClick={() => setNeedsLyricsOnly(!needsLyricsOnly)}>
          <Type className="size-3.5" strokeWidth={1.5} /> Needs lyrics
        </Chip>
        <div className="flex-1" />
        <Select
          uiSize="sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          title="Sort"
        >
          <option value="added">Recently added</option>
          <option value="mostSung">Most sung</option>
          <option value="recentSung">Recently sung</option>
        </Select>
      </div>

      {songs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Mic2 className="size-12 text-accent" strokeWidth={1.5} />
          <p className="text-text-dim">Paste a YouTube link to add your first song</p>
          <Button variant="primary" size="md" onClick={() => setShowImport(true)}>
            <Plus className="size-4" strokeWidth={2} /> Add Song
          </Button>
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 overflow-y-auto px-6 pb-6">
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
            <p className="col-span-full py-12 text-center text-text-dim">No songs match.</p>
          )}
        </div>
      )}

      {imports.size > 0 &&
        (() => {
          const activeJob = [...imports.values()].find((p) => p.stage !== 'queued')
          const job = activeJob ?? [...imports.values()][0]
          if (!job) return null
          const title = songs.find((s) => s.id === job.songId)?.title ?? job.songId
          return (
            <div className="relative border-border border-t bg-surface px-6 py-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-dim">
                  {STRIP_LABEL[job.stage] ?? job.stage} · {title}
                </span>
                <span className="font-medium text-accent">{Math.round(job.progress * 100)}%</span>
                {imports.size > 1 && (
                  <span className="text-text-dim">· {imports.size - 1} more queued</span>
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
            title="Delete song?"
            body={`"${pendingDelete.title}" by ${pendingDelete.artist} will be removed from your library, including its audio files and lyrics.`}
            confirmLabel="Delete"
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Library
