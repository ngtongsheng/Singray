import { Heart, Type, X } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language, LanguageDef } from '../../../../shared/types'
import { useLibraryContext } from '../../context/LibraryContext'
import { Chip, Stack } from '../ui'

interface Props {
  langDefs: LanguageDef[]
}

/** Filter chips row: artist filter (if any), language, favorites, needs-lyrics. */
function FilterChips({ langDefs }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const {
    songs,
    artistFilter,
    clearArtistFilter,
    language,
    setLanguage,
    favoritesOnly,
    setFavoritesOnly,
    needsLyricsOnly,
    setNeedsLyricsOnly
  } = useLibraryContext()

  // Filter chips (R2.4): settings languages first, then any extra codes still on
  // songs (e.g. a removed language) so every song stays filterable.
  const languages = useMemo(
    () => [...new Set([...langDefs.map((l) => l.code), ...songs.map((s) => s.language)])],
    [langDefs, songs]
  )
  const langLabel = (code: Language): string =>
    langDefs.find((l) => l.code === code)?.label ??
    (code === 'unknown' ? t('common.unknown') : code)

  return (
    <Stack gap={2} wrap>
      {artistFilter !== null && (
        <Chip active onClick={clearArtistFilter} title={t('library.clearArtistFilter')}>
          {t('library.artistFilter', { name: artistFilter || t('common.unknown') })}
          <X className="size-3.5" strokeWidth={1.5} />
        </Chip>
      )}
      {languages.map((lang) => (
        <Chip
          key={lang}
          active={language === lang}
          onClick={() => setLanguage(language === lang ? null : lang)}
        >
          {langLabel(lang)}
        </Chip>
      ))}
      <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
        <Heart className="size-3.5" strokeWidth={1.5} /> {t('library.favorites')}
      </Chip>
      <Chip active={needsLyricsOnly} onClick={() => setNeedsLyricsOnly(!needsLyricsOnly)}>
        <Type className="size-3.5" strokeWidth={1.5} /> {t('library.needsLyrics')}
      </Chip>
    </Stack>
  )
}

export default FilterChips
