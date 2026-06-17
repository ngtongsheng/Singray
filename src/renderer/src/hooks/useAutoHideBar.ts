import { useCallback, useEffect, useRef, useState } from 'react'

const HIDE_AFTER_MS = 3000

interface Result {
  barVisible: boolean
  poke: () => void
}

/** Pinned: bar always visible. Unpinned: any activity shows it and re-arms the 3s timer (§10.6). */
export function useAutoHideBar(pinned: boolean): Result {
  const [barVisible, setBarVisible] = useState(true)
  const hideTimer = useRef<number>(0)

  const poke = useCallback(() => {
    setBarVisible(true)
    window.clearTimeout(hideTimer.current)
    if (!pinned) hideTimer.current = window.setTimeout(() => setBarVisible(false), HIDE_AFTER_MS)
  }, [pinned])

  useEffect(() => {
    poke()
    window.addEventListener('mousemove', poke)
    return () => {
      window.removeEventListener('mousemove', poke)
      window.clearTimeout(hideTimer.current)
    }
  }, [poke])

  return { barVisible, poke }
}
