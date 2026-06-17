import type { MouseEventHandler } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from './ui/cx'

interface Props {
  artist: string
  onClick: MouseEventHandler<HTMLButtonElement>
  className?: string
}

/** Artist name rendered as a hover-underline link button (title row, card, dialog). */
function ArtistLink({ artist, onClick, className }: Props): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('library.viewArtist', { name: artist })}
      className={cx(
        'truncate text-left text-text-dim text-xs hover:text-text hover:underline',
        className
      )}
    >
      {artist}
    </button>
  )
}

export default ArtistLink
