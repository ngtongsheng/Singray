import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LanguageDef, SongListItem } from '../../../shared/types'
import { Button, Dialog, Stack, Text } from './ui'

interface Props {
  song: SongListItem
  onClose: () => void
  onArtistClick: (artist: string) => void
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** SNG1: read-only song metadata + sing history, opened from the player's overflow menu. */
function SongDetailsDialog({ song, onClose, onArtistClick }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [languages, setLanguages] = useState<LanguageDef[]>([])

  useEffect(() => {
    window.singray.settings.get().then((s) => setLanguages(s.languages))
  }, [])

  const languageLabel =
    languages.find((l) => l.code === song.language)?.label ?? (song.language || t('common.unknown'))

  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleString(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })

  const Row = ({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element => (
    <Stack justify="between" align="baseline" gap={4}>
      <Text as="span" variant="hint" className="shrink-0 whitespace-nowrap">
        {label}
      </Text>
      <span className="min-w-0 truncate text-right text-sm">{value}</span>
    </Stack>
  )

  return (
    <Dialog label={t('details.title')} width="w-[420px]" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={4}>
          <div>
            <Text as="h2" variant="title" className="truncate">
              {song.title}
            </Text>
            <button
              type="button"
              onClick={() => {
                onArtistClick(song.artist)
                onClose()
              }}
              title={t('library.viewArtist', { name: song.artist })}
              className="truncate text-left text-text-dim text-sm hover:text-text hover:underline"
            >
              {song.artist}
            </button>
          </div>

          <Stack direction="column" gap={2}>
            <Row label={t('details.duration')} value={fmtDuration(song.durationSec)} />
            <Row label={t('common.language')} value={languageLabel} />
            <Row label={t('details.added')} value={fmtDate(song.addedAt)} />
            <Row
              label={t('details.sungCount')}
              value={t('details.sungCount_value', { count: song.sings.length })}
            />
            <Row
              label={t('details.source')}
              value={song.youtubeUrl || song.sourceFile || t('common.unknown')}
            />
          </Stack>

          <div>
            <Text variant="hint" className="mb-1">
              {t('details.history')}
            </Text>
            {song.sings.length === 0 ? (
              <p className="text-sm text-text-dim">{t('details.noHistory')}</p>
            ) : (
              <ul className="max-h-32 overflow-y-auto text-sm">
                {[...song.sings].reverse().map((iso) => (
                  <li key={iso} className="py-0.5 text-text-dim">
                    {fmtDate(iso)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Stack>

        <Stack justify="end">
          <Button size="md" onClick={onClose}>
            {t('common.close')}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  )
}

export default SongDetailsDialog
