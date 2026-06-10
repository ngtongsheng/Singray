import { AlertTriangle, Heart, Loader2, Mic2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { ImportProgress, SongListItem } from '../../../shared/types'

interface Props {
  song: SongListItem
  importing: ImportProgress | undefined
  onDelete: (song: SongListItem) => void
}

const STAGE_LABEL: Record<string, string> = {
  queued: 'Queued',
  download: 'Downloading',
  separate: 'Separating',
  convert: 'Converting'
}

function StatusBadge({ song, importing }: Omit<Props, 'onDelete'>): React.JSX.Element | null {
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

function SongCard({ song, importing, onDelete }: Props): React.JSX.Element {
  const failed = !importing && (song.error !== null || !song.ready)

  return (
    <div className="group overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-text-dim/40">
      <div className="relative aspect-video bg-surface-2">
        {song.ready && (
          <img
            src={window.singray.audio.thumbUrl(song.id)}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        {song.favorite && (
          <Heart
            className="absolute top-2 right-2 size-5 fill-accent text-accent"
            strokeWidth={1.5}
          />
        )}
        <StatusBadge song={song} importing={importing} />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
                title="Sing — coming in Phase 3"
                className="flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 font-medium text-sm text-text disabled:opacity-50"
              >
                <Mic2 className="size-4" strokeWidth={1.5} /> Sing
              </button>
              <button
                type="button"
                disabled={!song.ready}
                title="Edit Lyrics — coming in Phase 2"
                className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <Pencil className="size-4" strokeWidth={1.5} /> Lyrics
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onDelete(song)}
            title="Delete song"
            className="rounded-control border border-border bg-surface p-1.5 text-danger hover:bg-surface-2"
          >
            <Trash2 className="size-4" strokeWidth={1.5} />
          </button>
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
