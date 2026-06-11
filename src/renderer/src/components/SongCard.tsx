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
import { useEffect, useRef, useState } from 'react'
import type { ImportProgress, SongListItem } from '../../../shared/types'

interface Props {
  song: SongListItem
  importing: ImportProgress | undefined
  onDelete: (song: SongListItem) => void
  onSing: (song: SongListItem) => void
}

const STAGE_LABEL: Record<string, string> = {
  queued: 'Queued',
  download: 'Downloading',
  separate: 'Separating',
  convert: 'Converting'
}

function StatusBadge({
  song,
  importing
}: Pick<Props, 'song' | 'importing'>): React.JSX.Element | null {
  if (importing) {
    return (
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-control bg-black/60 px-2 py-0.5 text-text text-xs">
        <Loader2 className="size-3 animate-spin" />
        {STAGE_LABEL[importing.stage] ?? importing.stage}
        {importing.stage !== 'queued' && ` ${Math.round(importing.progress * 100)}%`}
      </span>
    )
  }
  if (song.error || !song.ready) {
    return (
      <span
        className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-control bg-black/60 px-2 py-0.5 text-danger text-xs"
        title={song.error ?? 'import interrupted'}
      >
        <AlertTriangle className="size-3" /> Error
      </span>
    )
  }
  if (!song.hasLyrics) {
    return (
      <span className="absolute bottom-2 left-2 rounded-control bg-black/60 px-2 py-0.5 text-text-dim text-xs">
        needs lyrics
      </span>
    )
  }
  return null
}

function CardMenu({ song, onDelete }: Pick<Props, 'song' | 'onDelete'>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        title="More actions"
        className={`rounded-control bg-black/50 p-1 transition-opacity hover:bg-black/70 ${
          open ? '' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <MoreHorizontal className="size-4" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-40 overflow-hidden rounded-control border border-border bg-surface py-1 shadow-raised">
          <button
            type="button"
            className={itemClass}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              window.singray.library.openFolder(song.id)
            }}
          >
            <Folder className="size-3.5" strokeWidth={1.5} /> Open folder
          </button>
          <button
            type="button"
            className={`${itemClass} text-danger`}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onDelete(song)
            }}
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

function SongCard({ song, importing, onDelete, onSing }: Props): React.JSX.Element {
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
          <CardMenu song={song} onDelete={onDelete} />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            window.singray.library.updateMeta(song.id, { favorite: !song.favorite })
          }}
          title={song.favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`absolute top-2 right-2 rounded-control p-1 transition-opacity hover:scale-110 ${
            song.favorite ? '' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart
            className={`size-5 ${song.favorite ? 'fill-accent text-accent' : 'text-text'}`}
            strokeWidth={1.5}
          />
        </button>
        <StatusBadge song={song} importing={importing} />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                window.singray.import.retry(song.id)
              }}
              title="Retry import"
              className="flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 font-medium text-sm text-text hover:bg-accent-soft"
            >
              <RotateCcw className="size-4" strokeWidth={1.5} /> Retry
            </button>
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
            title="Times sung"
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
