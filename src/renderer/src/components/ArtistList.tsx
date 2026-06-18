import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLibraryContext } from '../context/LibraryContext'
import { Stack, Text } from './ui'

/** Artists section (ART1): every distinct artist with a song count, "" groups songs with no artist set. */
function ArtistList(): React.JSX.Element {
  const { t } = useTranslation()
  const { songs, onArtistClick } = useLibraryContext()

  const artists = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of songs) {
      const name = s.artist.trim()
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name || '￿').localeCompare(b.name || '￿', undefined, { numeric: true }))
  }, [songs])

  return (
    <Stack direction="column" gap={2} className="pt-3 pb-12">
      {artists.map(({ name, count }) => (
        <button
          key={name}
          type="button"
          onClick={() => onArtistClick(name)}
          className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-text-dim/40"
        >
          <Text as="span" variant="item">
            {name || t('common.unknown')}
          </Text>
          <Text as="span" variant="hint" className="shrink-0">
            {t('library.songCount', { count })}
          </Text>
        </button>
      ))}
    </Stack>
  )
}

export default ArtistList
