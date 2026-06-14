import {
  AlertTriangle,
  Folder,
  Heart,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ImportProgress, SongListItem } from '../../../shared/types'
import { IconButton, Menu, MenuItem, Stack, Text } from './ui'

interface Props {
  song: SongListItem
  importing: ImportProgress | undefined
  onDelete: (song: SongListItem) => void
  onSing: (song: SongListItem) => void
  onArtistClick: (artist: string) => void
}

/** Compact list row (HOME1): thumb, title/artist, favorite — list-view counterpart to SongCard. */
function SongRow({ song, importing, onDelete, onSing, onArtistClick }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const failed = !importing && (song.error !== null || !song.ready)
  const openable = !importing && !failed

  return (
    <Stack
      gap={3}
      role="button"
      tabIndex={0}
      onClick={() => openable && onSing(song)}
      onKeyDown={(e) => {
        if (openable && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault()
          onSing(song)
        }
      }}
      className={`group rounded-card border border-border bg-surface px-3 py-2 transition-colors hover:border-text-dim/40 ${
        openable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-control bg-surface-2">
        {song.ready && (
          <img
            src={window.singray.audio.thumbUrl(song.id)}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
        {importing && (
          <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-text-dim" />
        )}
        {failed && (
          <span
            className="absolute inset-0 m-auto flex size-4 items-center justify-center"
            title={song.error ?? t('card.importInterrupted')}
          >
            <AlertTriangle className="size-4 text-danger" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Text variant="item" title={song.title}>
          {song.title}
        </Text>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onArtistClick(song.artist)
          }}
          title={t('library.viewArtist', { name: song.artist })}
          className="truncate text-text-dim text-xs hover:text-text hover:underline"
        >
          {song.artist}
        </button>
      </div>
      {!song.hasLyrics && !failed && !importing && (
        <span className="shrink-0 rounded-control bg-surface-2 px-2 py-0.5 text-text-dim text-xs">
          {t('card.needsLyrics')}
        </span>
      )}
      {failed && (
        <IconButton
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            window.singray.import.retry(song.id)
          }}
          title={t('card.retryTip')}
          className="shrink-0 text-danger"
        >
          <RotateCcw className="size-4" strokeWidth={1.5} />
        </IconButton>
      )}
      <IconButton
        variant="bare"
        onClick={(e) => {
          e.stopPropagation()
          window.singray.library.updateMeta(song.id, { favorite: !song.favorite })
        }}
        title={song.favorite ? t('card.unfavorite') : t('card.favorite')}
        className="shrink-0"
      >
        <Heart
          className={`size-4 ${song.favorite ? 'fill-accent text-accent' : 'text-text-dim hover:text-text'}`}
          strokeWidth={1.5}
        />
      </IconButton>
      <Menu
        origin="top right"
        className="top-full right-0 mt-1 w-40 overflow-hidden py-1"
        trigger={(_open, toggle) => (
          <IconButton
            variant="bare"
            onClick={toggle}
            title={t('card.moreActions')}
            className="shrink-0 text-text-dim hover:text-text"
          >
            <MoreHorizontal className="size-4" strokeWidth={1.5} />
          </IconButton>
        )}
      >
        <MenuItem onSelect={() => window.singray.library.openFolder(song.id)}>
          <Folder className="size-3.5" strokeWidth={1.5} /> {t('card.openFolder')}
        </MenuItem>
        <MenuItem danger onSelect={() => onDelete(song)}>
          <Trash2 className="size-3.5" strokeWidth={1.5} /> {t('common.delete')}
        </MenuItem>
      </Menu>
    </Stack>
  )
}

export default SongRow
