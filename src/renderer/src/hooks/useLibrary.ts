import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { SongListItem } from '../../../shared/types'

export const LIBRARY_KEY = ['library'] as const

/** Library listing, kept fresh via the main process `library:changed` event. */
export function useLibrary(): { songs: SongListItem[] } {
  const qc = useQueryClient()
  const { data: songs = [] } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => window.singray.library.list()
  })
  useEffect(() => {
    return window.singray.onLibraryChanged(() => {
      qc.invalidateQueries({ queryKey: LIBRARY_KEY })
    })
  }, [qc])
  return { songs }
}
