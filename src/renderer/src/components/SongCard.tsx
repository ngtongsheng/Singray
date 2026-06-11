import {
  AlertTriangle,
  Folder,
  Heart,
  Loader2,
  Mic2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ImportProgress, SongListItem } from '../../../shared/types'

interface Props {
  song: SongListItem
  importing: ImportProgress | undefined
  onDelete: (song: SongListItem) => void
  onEdit: (song: SongListItem) => void
  onEditLyrics: (song: SongListItem) => void
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

function CardMenu({
  song,
  onDelete,
  onEdit
}: Pick<Props, 'song' | 'onDelete' | 'onEdit'>): React.JSX.Element {
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
        onClick={() => setOpen(!open)}
        title="More actions"
        className="rounded-control border border-border bg-surface p-1.5 hover:bg-surface-2"
      >
        <MoreHorizontal className="size-4" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-20 mt-1 w-40 -translate-x-1/2 overflow-hidden rounded-control border border-border bg-surface py-1 shadow-raised">
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false)
              onEdit(song)
            }}
          >
            <Pencil className="size-3.5" strokeWidth={1.5} /> Edit details
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false)
              window.singray.library.openFolder(song.id)
            }}
          >
            <Folder className="size-3.5" strokeWidth={1.5} /> Open folder
          </button>
          <button
            type="button"
            className={`${itemClass} text-danger`}
            onClick={() => {
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

function SongCard({
  song,
  importing,
  onDelete,
  onEdit,
  onEditLyrics,
  onSing
}: Props): React.JSX.Element {
  const failed = !importing && (song.error !== null || !song.ready)

  return (
    <div className="group rounded-card border border-border bg-surface transition-colors hover:border-text-dim/40">
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
        <button
          type="button"
          onClick={() => window.singray.library.updateMeta(song.id, { favorite: !song.favorite })}
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity duration-200 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          {failed && (
            <button
              type="button"
              onClick={() => window.singray.import.retry(song.id)}
              title="Retry import"
              className="flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 font-medium text-sm text-text hover:bg-accent-soft"
            >
              <RotateCcw className="size-4" strokeWidth={1.5} /> Retry
            </button>
          )}
          {!failed && (
            <>
              <button
                type="button"
                disabled={!song.ready}
                onClick={() => onSing(song)}
                title="Sing"
                className="flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 font-medium text-sm text-text hover:bg-accent-soft disabled:opacity-50"
              >
                <Mic2 className="size-4" strokeWidth={1.5} /> Sing
              </button>
              <button
                type="button"
                disabled={!song.ready}
                onClick={() => onEditLyrics(song)}
                title="Edit lyrics"
                className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <Pencil className="size-4" strokeWidth={1.5} /> Lyrics
              </button>
            </>
          )}
          <CardMenu song={song} onDelete={onDelete} onEdit={onEdit} />
        </div>
      </div>
      <div className="p-3">
        <p className="truncate font-medium text-sm" title={song.title}>
          {song.title}
        </p>
        <p className="truncate text-text-dim text-xs" title={song.artist}>
          {song.artist}
        </p>
      </div>
    </div>
  )
}

export default SongCard
