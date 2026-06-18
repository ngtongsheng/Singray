import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { SongListItem } from '../../../shared/types'

export type View =
  | { name: 'library'; artistFilter?: string }
  | { name: 'settings' }
  | { name: 'creator'; song: SongListItem }
  | { name: 'player'; song: SongListItem }

interface AppContextValue {
  view: View
  goLibrary: (artistFilter?: string) => void
  goSettings: () => void
  goPlayer: (song: SongListItem) => void
  goCreator: (song: SongListItem) => void
}

const AppContext = createContext<AppContextValue | null>(null)

/** Holds the current view + navigation actions, so screens can navigate via useAppContext() instead of onBack/onExit/... props drilled down from App. */
export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'library' })

  const goLibrary = useCallback(
    (artistFilter?: string) => setView({ name: 'library', artistFilter }),
    []
  )
  const goSettings = useCallback(() => setView({ name: 'settings' }), [])
  const goPlayer = useCallback((song: SongListItem) => setView({ name: 'player', song }), [])
  const goCreator = useCallback((song: SongListItem) => setView({ name: 'creator', song }), [])

  const value = useMemo<AppContextValue>(
    () => ({ view, goLibrary, goSettings, goPlayer, goCreator }),
    [view, goLibrary, goSettings, goPlayer, goCreator]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
