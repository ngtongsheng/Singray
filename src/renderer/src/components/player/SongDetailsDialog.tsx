import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SongListItem } from '../../../../shared/types'
import { useSettings } from '../../hooks/useSettings'
import ArtistLink from '../shared/ArtistLink'
import { Button, Dialog, DialogFooter, Stack, Text } from '../ui'

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
  const { settings } = useSettings()
  const languages = settings?.languages ?? []

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
    <Dialog label={t('details.title')} width="md" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={4}>
          <div>
            <Text as="h2" variant="title" className="truncate">
              {song.title}
            </Text>
            <ArtistLink
              artist={song.artist}
              onClick={() => {
                onArtistClick(song.artist)
                onClose()
              }}
              className="text-sm"
            />
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
              value={
                song.youtubeUrl ? (
                  <button
                    type="button"
                    title={song.youtubeUrl}
                    onClick={() => window.singray.window.openExternal(song.youtubeUrl)}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    YouTube
                    <ExternalLink className="size-3" />
                  </button>
                ) : (
                  song.sourceFile || t('common.unknown')
                )
              }
            />
          </Stack>
        </Stack>

        <DialogFooter>
          <Button size="md" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </Stack>
    </Dialog>
  )
}

export default SongDetailsDialog
