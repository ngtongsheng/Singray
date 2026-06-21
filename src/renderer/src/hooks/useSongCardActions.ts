import { useTranslation } from 'react-i18next'
import type { ImportProgress, PipelineStatus, SongListItem } from '../../../shared/types'

interface Options {
  song: SongListItem
  importing: ImportProgress | undefined
  onSing: (song: SongListItem) => void
  /** Re-checked here too: retry bypasses the import dialog entirely, so it
   *  needs its own guard against re-attempting a job that's certain to fail. */
  pipelineStatus: PipelineStatus | null
}

/** Shared click/keyboard/favorite/retry behavior between SongCard and SongRow. */
export function useSongCardActions({ song, importing, onSing, pipelineStatus }: Options): {
  failed: boolean
  openable: boolean
  onActivate: () => void
  onKeyActivate: (e: React.KeyboardEvent) => void
  toggleFavorite: (e: React.MouseEvent) => void
  retry: (e: React.MouseEvent) => void
  /** Set when retrying would just fail again (missing python/ffmpeg) — disable
   *  the retry button and explain why via this tooltip text instead. */
  retryBlockedReason: string | null
} {
  const { t } = useTranslation()
  const failed = !importing && (song.error !== null || !song.ready)
  const openable = !importing && !failed
  const retryBlockedReason =
    pipelineStatus === null || pipelineStatus.ready
      ? null
      : !pipelineStatus.python
        ? t('import.pythonMissing')
        : t('import.ffmpegMissing')

  return {
    failed,
    openable,
    retryBlockedReason,
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
      if (retryBlockedReason) return
      window.singray.import.retry(song.id)
    }
  }
}
