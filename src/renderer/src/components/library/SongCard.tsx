import { AlertTriangle, Heart, Loader2, MoreHorizontal, RotateCcw } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportProgress, ImportStage, SongListItem } from '../../../../shared/types'
import { useLibraryContext } from '../../context/LibraryContext'
import { useSongCardActions } from '../../hooks/useSongCardActions'
import ArtistLink from '../shared/ArtistLink'
import { AspectRatio, Button, Card, CardContent, IconButton, Text } from '../ui'
import SongCardMenu from './SongCardMenu'

interface Props {
  song: SongListItem
  importing: ImportProgress | undefined
}

const STAGE_KEY: Partial<Record<ImportStage, string>> = {
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
    const stageKey = STAGE_KEY[importing.stage]
    return (
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-foreground text-xs">
        <Loader2 className="size-3 animate-spin" />
        {stageKey ? t(stageKey) : importing.stage}
        {importing.stage !== 'queued' && ` ${Math.round(importing.progress * 100)}%`}
      </span>
    )
  }
  if (song.error || !song.ready) {
    return (
      <Text
        as="span"
        variant="error"
        className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5"
        title={song.error ?? t('card.importInterrupted')}
      >
        <AlertTriangle className="size-3" /> {t('card.error')}
      </Text>
    )
  }
  if (!song.hasLyrics) {
    return (
      <Text
        as="span"
        variant="hint"
        className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5"
      >
        {t('card.needsLyrics')}
      </Text>
    )
  }
  return null
}

const SongCard = memo(function SongCard({ song, importing }: Props): React.JSX.Element {
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
      className={`group overflow-hidden transition-colors hover:border-muted-foreground/40 ${
        openable ? 'cursor-pointer' : ''
      }`}
    >
      <AspectRatio ratio={16 / 9} className="bg-muted">
        {song.ready && (
          <img
            src={window.singray.audio.thumbUrl(song.id)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-2 left-2">
          <SongCardMenu
            song={song}
            onDelete={requestDelete}
            origin="top left"
            className="w-40 overflow-hidden"
            trigger={(open, toggle) => (
              <IconButton
                variant="bare"
                onClick={toggle}
                title={t('card.moreActions')}
                className={`rounded-md bg-black/50 p-1 transition-opacity hover:bg-black/70 ${
                  open ? '' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <MoreHorizontal className="size-4" strokeWidth={1.5} />
              </IconButton>
            )}
          />
        </div>
        <IconButton
          variant="bare"
          onClick={toggleFavorite}
          title={song.favorite ? t('card.unfavorite') : t('card.favorite')}
          className={`absolute top-2 right-2 rounded-md p-1 transition-opacity hover:scale-110 ${
            song.favorite ? '' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart
            className={`size-5 ${song.favorite ? 'fill-primary text-primary' : 'text-foreground'}`}
            strokeWidth={1.5}
          />
        </IconButton>
        <StatusBadge song={song} importing={importing} />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <Button variant="primary" onClick={retry} title={t('card.retryTip')}>
              <RotateCcw className="size-4" strokeWidth={1.5} /> {t('card.retry')}
            </Button>
          </div>
        )}
      </AspectRatio>
      <CardContent className="p-3">
        <Text variant="item" title={song.title}>
          {song.title}
        </Text>
        <ArtistLink artists={song.artists} onClick={onArtistClick} className="min-w-0 max-w-full" />
      </CardContent>
    </Card>
  )
})

export default SongCard
