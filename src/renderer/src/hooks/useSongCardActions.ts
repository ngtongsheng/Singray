import type { ImportProgress, SongListItem } from '../../../shared/types'

interface Options {
  song: SongListItem
  importing: ImportProgress | undefined
  onSing: (song: SongListItem) => void
}

/** Shared click/keyboard/favorite/retry behavior between SongCard and SongRow. */
export function useSongCardActions({ song, importing, onSing }: Options): {
  failed: boolean
  openable: boolean
  onActivate: () => void
  onKeyActivate: (e: React.KeyboardEvent) => void
  toggleFavorite: (e: React.MouseEvent) => void
  retry: (e: React.MouseEvent) => void
} {
  const failed = !importing && (song.error !== null || !song.ready)
  const openable = !importing && !failed

  return {
    failed,
    openable,
    onActivate: () => {
      if (openable) onSing(song)
    },
    onKeyActivate: (e) => {
      if (openable && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault()
        onSing(song)
      }
    },
    toggleFavorite: (e) => {
      e.stopPropagation()
      window.singray.library.updateMeta(song.id, { favorite: !song.favorite })
    },
    retry: (e) => {
      e.stopPropagation()
      window.singray.import.retry(song.id)
    }
  }
}
