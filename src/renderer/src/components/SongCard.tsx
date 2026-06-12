import {
  AlertTriangle,
  Folder,
  Heart,
  Loader2,
  Mic2,
  MoreHorizontal,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ImportProgress, SongListItem } from '../../../shared/types'
import { Button, IconButton, Menu, MenuItem } from './ui'

interface Props {
  song: SongListItem
  importing: ImportProgress | undefined
  onDelete: (song: SongListItem) => void
  onSing: (song: SongListItem) => void
}

const STAGE_KEY: Record<string, string> = {
  queued: 'stage.queued',
  download: 'stage.download',
  separate: 'stage.separate',
  convert: 'stage.convert'
}

function StatusBadge({
  song,
  importing
}: Pick<Props, 'song' | 'importing'>): React.JSX.Element | null {
  const { t } = useTranslation()
  if (importing) {
    return (
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-control bg-black/60 px-2 py-0.5 text-text text-xs">
        <Loader2 className="size-3 animate-spin" />
        {STAGE_KEY[importing.stage] ? t(STAGE_KEY[importing.stage] as string) : importing.stage}
        {importing.stage !== 'queued' && ` ${Math.round(importing.progress * 100)}%`}
      </span>
    )
  }
  if (song.error || !song.ready) {
    return (
      <span
        className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-control bg-black/60 px-2 py-0.5 text-danger text-xs"
        title={song.error ?? t('card.importInterrupted')}
      >
        <AlertTriangle className="size-3" /> {t('card.error')}
      </span>
    )
  }
  if (!song.hasLyrics) {
    return (
      <span className="absolute bottom-2 left-2 rounded-control bg-black/60 px-2 py-0.5 text-text-dim text-xs">
        {t('card.needsLyrics')}
      </span>
    )
  }
  return null
}

function SongCard({ song, importing, onDelete, onSing }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const failed = !importing && (song.error !== null || !song.ready)
  const openable = !importing && !failed

  return (
    // biome-ignore lint/a11y/useSemanticElements: card contains nested buttons (heart/menu/retry) — a real <button> can't nest them
    <div
      role="button"
      tabIndex={0}
      onClick={() => openable && onSing(song)}
      onKeyDown={(e) => {
        if (openable && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault()
          onSing(song)
        }
      }}
      className={`group rounded-card border border-border bg-surface transition-colors hover:border-text-dim/40 ${
        openable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-card bg-surface-2">
        {song.ready && (
          <img
            src={window.singray.audio.thumbUrl(song.id)}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-2 left-2">
          <Menu
            origin="top left"
            className="top-full left-0 mt-1 w-40 overflow-hidden py-1"
            trigger={(open, toggle) => (
              <IconButton
                variant="bare"
                onClick={toggle}
                title={t('card.moreActions')}
                className={`rounded-control bg-black/50 p-1 transition-opacity hover:bg-black/70 ${
                  open ? '' : 'opacity-0 group-hover:opacity-100'
                }`}
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
        </div>
        <IconButton
          variant="bare"
          onClick={(e) => {
            e.stopPropagation()
            window.singray.library.updateMeta(song.id, { favorite: !song.favorite })
          }}
          title={song.favorite ? t('card.unfavorite') : t('card.favorite')}
          className={`absolute top-2 right-2 rounded-control p-1 transition-opacity hover:scale-110 ${
            song.favorite ? '' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart
            className={`size-5 ${song.favorite ? 'fill-accent text-accent' : 'text-text'}`}
            strokeWidth={1.5}
          />
        </IconButton>
        <StatusBadge song={song} importing={importing} />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <Button
              variant="primary"
              onClick={(e) => {
                e.stopPropagation()
                window.singray.import.retry(song.id)
              }}
              title={t('card.retryTip')}
            >
              <RotateCcw className="size-4" strokeWidth={1.5} /> {t('card.retry')}
            </Button>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate font-medium text-sm" title={song.title}>
          {song.title}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-text-dim text-xs" title={song.artist}>
            {song.artist}
          </p>
          <span
            className="flex shrink-0 items-center gap-1 text-text-dim text-xs tabular-nums"
            title={t('card.timesSung')}
          >
            <Mic2 className="size-3" strokeWidth={1.5} />
            {song.playCount + song.sings.length}
          </span>
        </div>
      </div>
    </div>
  )
}

export default SongCard
