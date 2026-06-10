import { Heart, Mic2, Pencil, Trash2 } from 'lucide-react'
import type { SongListItem } from '../../../shared/types'

interface Props {
  song: SongListItem
  onDelete: (song: SongListItem) => void
}

function SongCard({ song, onDelete }: Props): React.JSX.Element {
  return (
    <div className="group overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-text-dim/40">
      <div className="relative aspect-video bg-surface-2">
        <img
          src={window.singray.audio.thumbUrl(song.id)}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        {song.favorite && (
          <Heart
            className="absolute top-2 right-2 size-5 fill-accent text-accent"
            strokeWidth={1.5}
          />
        )}
        {!song.hasLyrics && (
          <span className="absolute bottom-2 left-2 rounded-control bg-black/60 px-2 py-0.5 text-text-dim text-xs">
            needs lyrics
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            type="button"
            disabled
            title="Sing — coming in Phase 3"
            className="flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 font-medium text-sm text-text disabled:opacity-50"
          >
            <Mic2 className="size-4" strokeWidth={1.5} /> Sing
          </button>
          <button
            type="button"
            disabled
            title="Edit Lyrics — coming in Phase 2"
            className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <Pencil className="size-4" strokeWidth={1.5} /> Lyrics
          </button>
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
