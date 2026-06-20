import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { SongListItem } from '../../../shared/types'

export type View =
  | { name: 'library'; artistFilter?: string }
  | { name: 'settings' }
  | { name: 'creator'; song: SongListItem }
  | { name: 'player'; song: SongListItem }

interface NavState {
  back: View[]
  current: View
  forward: View[]
}

interface AppContextValue {
  view: View
  goLibrary: (artistFilter?: string) => void
  goSettings: () => void
  goPlayer: (song: SongListItem) => void
  goCreator: (song: SongListItem) => void
  goBack: () => void
  goForward: () => void
  canGoBack: boolean
  canGoForward: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

/** Holds the current view + navigation history. All go* actions push to the back stack. Alt+←/→ navigate back/forward. */
export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [nav, setNav] = useState<NavState>({
    back: [],
    current: { name: 'library' },
    forward: []
  })

  const push = useCallback((next: View) => {
    setNav((prev) => ({ back: [...prev.back, prev.current], current: next, forward: [] }))
  }, [])

  const goLibrary = useCallback(
    (artistFilter?: string) => push({ name: 'library', artistFilter }),
    [push]
  )
  const goSettings = useCallback(() => push({ name: 'settings' }), [push])
  const goPlayer = useCallback((song: SongListItem) => push({ name: 'player', song }), [push])
  const goCreator = useCallback((song: SongListItem) => push({ name: 'creator', song }), [push])

  const goBack = useCallback(() => {
    setNav((prev) => {
      if (!prev.back.length) return prev
      const current = prev.back[prev.back.length - 1] as View
      return { back: prev.back.slice(0, -1), current, forward: [prev.current, ...prev.forward] }
    })
  }, [])

  const goForward = useCallback(() => {
    setNav((prev) => {
      if (!prev.forward.length) return prev
      const current = prev.forward[0] as View
      return { back: [...prev.back, prev.current], current, forward: prev.forward.slice(1) }
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.altKey) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goForward()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [goBack, goForward])

  const value = useMemo<AppContextValue>(
    () => ({
      view: nav.current,
      goLibrary,
      goSettings,
      goPlayer,
      goCreator,
      goBack,
      goForward,
      canGoBack: nav.back.length > 0,
      canGoForward: nav.forward.length > 0
    }),
    [nav, goLibrary, goSettings, goPlayer, goCreator, goBack, goForward]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
