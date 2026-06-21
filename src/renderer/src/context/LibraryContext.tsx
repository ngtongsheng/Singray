import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  ImportProgress,
  Language,
  PipelineStatus,
  Settings,
  SongListItem
} from '../../../shared/types'
import { useImports } from '../hooks/useImports'
import { useLibrary } from '../hooks/useLibrary'
import { usePipelineStatus } from '../hooks/usePipelineStatus'
import { useSettings } from '../hooks/useSettings'
import { useAppContext } from './AppContext'

export type SortMode = 'added' | 'mostSung' | 'recentSung'
export type Section = 'songs' | 'artists'
export type LibraryViewMode = Settings['libraryView']

/** Sing count with the legacy MVP playCount as floor (R1.5 migration). */
const singCount = (s: SongListItem): number => s.playCount + s.sings.length
const lastSungAt = (s: SongListItem): string => s.sings.at(-1) ?? s.lastPlayedAt ?? ''

interface LibraryContextValue {
  songs: SongListItem[]
  filteredSongs: SongListItem[]
  imports: Map<string, ImportProgress>
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
  showImport: boolean
  openImport: () => void
  closeImport: () => void
  /** Fresh (uncached) pipeline status — null until the first fetch resolves. */
  pipelineStatus: PipelineStatus | null
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
  const { songs } = useLibrary()
  const { settings, patch } = useSettings()
  const imports = useImports()
  const pipelineStatus = usePipelineStatus()
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<Language | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [needsLyricsOnly, setNeedsLyricsOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('added')
  const [section, setSection] = useState<Section>('songs')
  const [view, setView] = useState<LibraryViewMode>(settings?.libraryView ?? 'grid')
  const [artistFilter, setArtistFilter] = useState<string | null>(initialArtistFilter ?? null)
  const [pendingDelete, setPendingDelete] = useState<SongListItem | null>(null)
  const [showImport, setShowImport] = useState(false)

  // ART2: navigating in from a song's artist name re-applies the filter even
  // though Library stays mounted (App.tsx key is constant).
  useEffect(() => {
    if (initialArtistFilter === undefined) return
    setArtistFilter(initialArtistFilter.trim())
    setSection('songs')
  }, [initialArtistFilter])

  const setViewMode = useCallback(
    (v: LibraryViewMode) => {
      setView(v)
      void patch({ libraryView: v })
    },
    [patch]
  )

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

  const openImport = useCallback(() => setShowImport(true), [])
  const closeImport = useCallback(() => setShowImport(false), [])

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = songs.filter((s) => {
      if (
        q &&
        !s.title.toLowerCase().includes(q) &&
        !s.artists.some((a) => a.toLowerCase().includes(q))
      )
        return false
      if (language && s.language !== language) return false
      if (favoritesOnly && !s.favorite) return false
      if (needsLyricsOnly && s.hasLyrics) return false
      if (artistFilter !== null) {
        const hasFilter =
          artistFilter === ''
            ? s.artists.length === 0
            : s.artists.some((a) => a.trim() === artistFilter)
        if (!hasFilter) return false
      }
      return true
    })
    // 'added' keeps the listing order (addedAt desc from main)
    if (sort === 'mostSung') list.sort((a, b) => singCount(b) - singCount(a))
    else if (sort === 'recentSung') list.sort((a, b) => lastSungAt(b).localeCompare(lastSungAt(a)))
    return list
  }, [songs, query, language, favoritesOnly, needsLyricsOnly, artistFilter, sort])

  const value = useMemo<LibraryContextValue>(
    () => ({
      songs,
      filteredSongs,
      imports,
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
      confirmDelete,
      showImport,
      openImport,
      closeImport,
      pipelineStatus
    }),
    [
      songs,
      filteredSongs,
      imports,
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
      confirmDelete,
      showImport,
      openImport,
      closeImport,
      pipelineStatus
    ]
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibraryContext(): LibraryContextValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibraryContext must be used within LibraryProvider')
  return ctx
}
