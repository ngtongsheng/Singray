import { clsx as cx } from 'clsx'
import { Fragment, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Text } from '../ui'

interface Props {
  artists: string[]
  onClick: (artist: string) => void
  className?: string
}

/** Artist name(s) rendered as hover-underline link buttons, comma-separated (title row, card, dialog). */
const ArtistLink = memo(function ArtistLink({
  artists,
  onClick,
  className
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const wrapperClass = cx('truncate text-left', className)

  if (artists.length === 0) {
    return (
      <Text as="span" variant="hint" className={wrapperClass}>
        {t('common.unknown')}
      </Text>
    )
  }

  return (
    <Text as="span" variant="hint" className={wrapperClass}>
      {artists.map((artist, i) => (
        <Fragment key={artist}>
          {i > 0 && ', '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClick(artist)
            }}
            title={t('library.viewArtist', { name: artist })}
            className="hover:text-foreground hover:underline"
          >
            {artist}
          </button>
        </Fragment>
      ))}
    </Text>
  )
})

export default ArtistLink
