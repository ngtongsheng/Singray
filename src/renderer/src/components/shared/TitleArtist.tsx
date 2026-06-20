import { clsx as cx } from 'clsx'
import { Stack, Text } from '../ui'
import ArtistLink from './ArtistLink'

interface Props {
  title: string
  artists: string[]
  onArtistClick?: (artist: string) => void
  label?: React.ReactNode
  className?: string
}

/** Title + artist on one baseline-aligned row, optional label above (header title rows: player, lyric creator, recordings). */
function TitleArtist({
  title,
  artists,
  onArtistClick,
  label,
  className
}: Props): React.JSX.Element {
  const artist = onArtistClick ? (
    <ArtistLink artists={artists} onClick={onArtistClick} className="app-no-drag shrink-0" />
  ) : (
    <Text variant="hint" className="hidden truncate sm:inline">
      {artists.join(', ')}
    </Text>
  )

  const row = (
    <Stack gap={2} align="baseline" className="min-w-0 leading-none">
      <Text as="h1" variant="subtitle" className="truncate">
        {title}
      </Text>
      {artist}
    </Stack>
  )

  if (!label) {
    return <div className={cx('min-w-0', className)}>{row}</div>
  }

  return (
    <Stack direction="column" gap={0} className={cx('min-w-0 leading-none', className)}>
      {label}
      {row}
    </Stack>
  )
}

export default TitleArtist
