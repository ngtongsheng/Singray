import { useCallback, useEffect, useState } from 'react'
import type { SongListItem } from '../../../shared/types'

/** Library listing, kept fresh via the main process `library:changed` event. */
export function useLibrary(): { songs: SongListItem[]; refresh: () => void } {
  const [songs, setSongs] = useState<SongListItem[]>([])

  const refresh = useCallback(() => {
    window.singray.library.list().then(setSongs)
  }, [])

  useEffect(() => {
    refresh()
    return window.singray.onLibraryChanged(refresh)
  }, [refresh])

  return { songs, refresh }
}
