import { AlertTriangle, Heart, Loader2, MoreHorizontal, RotateCcw } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportProgress, SongListItem } from '../../../../shared/types'
import { useLibraryContext } from '../../context/LibraryContext'
import { useSongCardActions } from '../../hooks/useSongCardActions'
import ArtistLink from '../shared/ArtistLink'
import { IconButton, Stack, Text } from '../ui'
import SongCardMenu from './SongCardMenu'

interface Props {
  song: SongListItem
  importing: ImportProgress | undefined
}

/** Compact list row (HOME1): thumb, title/artist, favorite — list-view counterpart to SongCard. */
const SongRow = memo(function SongRow({ song, importing }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { onSing, onArtistClick, requestDelete } = useLibraryContext()
  const { failed, openable, onActivate, onKeyActivate, toggleFavorite, retry } = useSongCardActions(
    { song, importing, onSing }
  )

  return (
    <Stack
      gap={3}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={onKeyActivate}
      className={`group rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-muted-foreground/40 ${
        openable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {song.ready && (
          <img
            src={window.singray.audio.thumbUrl(song.id)}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
        {importing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {failed && (
          <span title={song.error ?? t('card.importInterrupted')}>
            <AlertTriangle className="size-4 text-destructive" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Text variant="item" title={song.title}>
          {song.title}
        </Text>
        <ArtistLink
          artist={song.artist}
          onClick={(e) => {
            e.stopPropagation()
            onArtistClick(song.artist)
          }}
        />
      </div>
      {!song.hasLyrics && !failed && !importing && (
        <Text as="span" variant="hint" className="shrink-0 rounded-md bg-muted px-2 py-0.5">
          {t('card.needsLyrics')}
        </Text>
      )}
      {failed && (
        <IconButton
          variant="ghost"
          size="sm"
          onClick={retry}
          title={t('card.retryTip')}
          className="shrink-0 text-destructive"
        >
          <RotateCcw className="size-4" strokeWidth={1.5} />
        </IconButton>
      )}
      <IconButton
        variant="bare"
        onClick={toggleFavorite}
        title={song.favorite ? t('card.unfavorite') : t('card.favorite')}
        className="shrink-0"
      >
        <Heart
          className={`size-4 ${song.favorite ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          strokeWidth={1.5}
        />
      </IconButton>
      <SongCardMenu
        song={song}
        onDelete={requestDelete}
        origin="top right"
        className="top-full right-0 translate-y-1 w-40 overflow-hidden py-1"
        trigger={(_open, toggle) => (
          <IconButton
            variant="bare"
            onClick={toggle}
            title={t('card.moreActions')}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-4" strokeWidth={1.5} />
          </IconButton>
        )}
      />
    </Stack>
  )
})

export default SongRow
