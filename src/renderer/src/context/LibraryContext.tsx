import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Language, Settings, SongListItem } from '../../../shared/types'
import { useAppContext } from './AppContext'

export type SortMode = 'added' | 'mostSung' | 'recentSung'
export type Section = 'songs' | 'artists'
export type LibraryViewMode = Settings['libraryView']

interface LibraryContextValue {
  query: string
  setQuery: (q: string) => void
  language: Language | null
  setLanguage: (l: Language | null) => void
  favoritesOnly: boolean
  setFavoritesOnly: (v: boolean) => void
  needsLyricsOnly: boolean
  setNeedsLyricsOnly: (v: boolean) => void
  sort: SortMode
  setSort: (s: SortMode) => void
  section: Section
  setSection: (s: Section) => void
  view: LibraryViewMode
  setViewMode: (v: LibraryViewMode) => void
  artistFilter: string | null
  clearArtistFilter: () => void
  onArtistClick: (artist: string) => void
  onSing: (song: SongListItem) => void
  pendingDelete: SongListItem | null
  requestDelete: (song: SongListItem) => void
  cancelDelete: () => void
  confirmDelete: () => Promise<void>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

interface ProviderProps {
  /** Set when navigating from a song's artist name (ART2): pre-applies the artist filter. */
  initialArtistFilter?: string
  children: React.ReactNode
}

/** Library's filter/sort/view-mode state + song-row callbacks, so SongCard/SongRow read them via useLibraryContext() instead of props threaded through Library. */
export function LibraryProvider({
  initialArtistFilter,
  children
}: ProviderProps): React.JSX.Element {
  const { goPlayer } = useAppContext()
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<Language | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [needsLyricsOnly, setNeedsLyricsOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('added')
  const [section, setSection] = useState<Section>('songs')
  const [view, setView] = useState<LibraryViewMode>('grid')
  const [artistFilter, setArtistFilter] = useState<string | null>(initialArtistFilter ?? null)
  const [pendingDelete, setPendingDelete] = useState<SongListItem | null>(null)

  useEffect(() => {
    window.singray.settings.get().then((s) => setView(s.libraryView))
  }, [])

  // ART2: navigating in from a song's artist name re-applies the filter even
  // though Library stays mounted (App.tsx key is constant).
  useEffect(() => {
    if (initialArtistFilter === undefined) return
    setArtistFilter(initialArtistFilter.trim())
    setSection('songs')
  }, [initialArtistFilter])

  const setViewMode = useCallback((v: LibraryViewMode) => {
    setView(v)
    void window.singray.settings.set({ libraryView: v })
  }, [])

  const clearArtistFilter = useCallback(() => setArtistFilter(null), [])

  const onArtistClick = useCallback((artist: string): void => {
    setArtistFilter(artist.trim())
    setSection('songs')
  }, [])

  const requestDelete = useCallback((song: SongListItem) => setPendingDelete(song), [])
  const cancelDelete = useCallback(() => setPendingDelete(null), [])
  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!pendingDelete) return
    await window.singray.library.delete(pendingDelete.id)
    setPendingDelete(null)
  }, [pendingDelete])

  const value = useMemo<LibraryContextValue>(
    () => ({
      query,
      setQuery,
      language,
      setLanguage,
      favoritesOnly,
      setFavoritesOnly,
      needsLyricsOnly,
      setNeedsLyricsOnly,
      sort,
      setSort,
      section,
      setSection,
      view,
      setViewMode,
      artistFilter,
      clearArtistFilter,
      onArtistClick,
      onSing: goPlayer,
      pendingDelete,
      requestDelete,
      cancelDelete,
      confirmDelete
    }),
    [
      query,
      language,
      favoritesOnly,
      needsLyricsOnly,
      sort,
      section,
      view,
      setViewMode,
      artistFilter,
      clearArtistFilter,
      onArtistClick,
      goPlayer,
      pendingDelete,
      requestDelete,
      cancelDelete,
      confirmDelete
    ]
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibraryContext(): LibraryContextValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibraryContext must be used within LibraryProvider')
  return ctx
}
