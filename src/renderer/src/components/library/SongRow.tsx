import { AlertTriangle, Heart, Loader2, MoreHorizontal, RotateCcw } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportProgress, SongListItem } from '../../../../shared/types'
import { useLibraryContext } from '../../context/LibraryContext'
import { useSongCardActions } from '../../hooks/useSongCardActions'
import ArtistLink from '../shared/ArtistLink'
import { AspectRatio, Card, IconButton, Stack, Text } from '../ui'
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
    <Card
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={onKeyActivate}
      className={`group transition-colors hover:border-muted-foreground/40 ${
        openable ? 'cursor-pointer' : ''
      }`}
    >
      <Stack gap={3} align="center" className="p-3">
        <div className="relative w-24 shrink-0 overflow-hidden rounded-md">
          <AspectRatio ratio={16 / 9} className="flex items-center justify-center bg-muted">
            {song.ready && (
              <img
                src={window.singray.audio.thumbUrl(song.id, song.thumbVersion)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            )}
            {importing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {failed && (
              <span title={song.error ?? t('card.importInterrupted')}>
                <AlertTriangle className="size-4 text-destructive" />
              </span>
            )}
          </AspectRatio>
        </div>
        <div className="min-w-0 flex-1">
          <Text variant="item" title={song.title}>
            {song.title}
          </Text>
          <ArtistLink artists={song.artists} onClick={onArtistClick} />
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
          className="w-40 overflow-hidden"
          trigger={(_open, toggle) => (
            <IconButton
              variant="bare"
              onClick={toggle}
              title={t('card.moreActions')}
              aria-label={t('card.moreActions')}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-4" strokeWidth={1.5} />
            </IconButton>
          )}
        />
      </Stack>
    </Card>
  )
})

export default SongRow
