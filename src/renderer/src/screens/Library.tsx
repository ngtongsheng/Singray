import { Heart, Mic2, Plus, Search, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language, SongListItem } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import SongCard from '../components/SongCard'
import { useLibrary } from '../hooks/useLibrary'

const LANGUAGE_LABEL: Record<Language, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  unknown: 'Unknown'
}

function chipClass(active: boolean): string {
  return `flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
    active
      ? 'border-accent bg-accent/15 text-accent'
      : 'border-border text-text-dim hover:border-text-dim hover:text-text'
  }`
}

function Library(): React.JSX.Element {
  const { songs } = useLibrary()
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<Language | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [needsLyricsOnly, setNeedsLyricsOnly] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SongListItem | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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
    return songs.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q) && !s.artist.toLowerCase().includes(q))
        return false
      if (language && s.language !== language) return false
      if (favoritesOnly && !s.favorite) return false
      if (needsLyricsOnly && s.hasLyrics) return false
      return true
    })
  }, [songs, query, language, favoritesOnly, needsLyricsOnly])

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return
    await window.singray.library.delete(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-border border-b bg-bg px-6 py-3">
        <h1 className="font-semibold text-lg">Singray</h1>
        <div className="relative ml-4 w-72">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-text-dim" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or artist  ( / )"
            className="w-full rounded-control border border-border bg-surface py-1.5 pr-3 pl-8 text-sm placeholder:text-text-dim/60"
          />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          disabled
          title="Add Song — coming in S1.4"
          className="flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 font-medium text-sm text-text disabled:opacity-50"
        >
          <Plus className="size-4" strokeWidth={2} /> Add Song
        </button>
      </header>

      <div className="flex items-center gap-2 px-6 py-3">
        {languages.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(language === lang ? null : lang)}
            className={chipClass(language === lang)}
          >
            {LANGUAGE_LABEL[lang]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={chipClass(favoritesOnly)}
        >
          <Heart className="size-3.5" strokeWidth={1.5} /> Favorites
        </button>
        <button
          type="button"
          onClick={() => setNeedsLyricsOnly(!needsLyricsOnly)}
          className={chipClass(needsLyricsOnly)}
        >
          <Type className="size-3.5" strokeWidth={1.5} /> Needs lyrics
        </button>
      </div>

      {songs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Mic2 className="size-12 text-accent" strokeWidth={1.5} />
          <p className="text-text-dim">Paste a YouTube link to add your first song</p>
          <button
            type="button"
            disabled
            title="Add Song — coming in S1.4"
            className="flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 font-medium text-sm text-text disabled:opacity-50"
          >
            <Plus className="size-4" strokeWidth={2} /> Add Song
          </button>
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 overflow-y-auto px-6 pb-6">
          {filtered.map((song) => (
            <SongCard key={song.id} song={song} onDelete={setPendingDelete} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-text-dim">No songs match.</p>
          )}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete song?"
          body={`"${pendingDelete.title}" by ${pendingDelete.artist} will be removed from your library, including its audio files and lyrics.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

export default Library
