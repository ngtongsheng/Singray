import { Loader2, Music } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LrclibHit, LrclibQuery } from '../../../shared/types'
import { Button, DialogFooter, Stack, Text } from './ui'
import Dialog from './ui/Dialog'

interface Props {
  query: LrclibQuery
  onPick: (hit: LrclibHit) => void
  onClose: () => void
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60)
  return `${m}:${Math.floor(sec % 60)
    .toString()
    .padStart(2, '0')}`
}

/** LRCLIB lyric finder (R3.5): fetches candidates on open; caller decides synced vs plain. */
function LrclibFinderDialog({ query, onPick, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [hits, setHits] = useState<LrclibHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    window.singray.lyrics
      .findLyrics(query)
      .then((r) => live && setHits(r))
      .catch(
        (e: Error) =>
          live && setError(e.message.replace(/^Error invoking remote method[^:]*: Error: /, ''))
      )
    return () => {
      live = false
    }
  }, [query])

  return (
    <Dialog label={t('finder.title')} width="md" onClose={onClose}>
      <Stack direction="column" gap={5}>
        <Stack direction="column" gap={4}>
          <Stack direction="column" gap={1}>
            <Text as="h2" variant="title">
              {t('finder.title')}
            </Text>
            <Text variant="hint">
              {t('finder.subtitle', { title: query.title, artist: query.artist })}
            </Text>
          </Stack>

          {hits === null && !error && (
            <Stack justify="center" gap={2} className="py-10 text-text-dim text-sm">
              <Loader2 className="size-4 animate-spin" strokeWidth={2} /> {t('finder.searching')}
            </Stack>
          )}
          {error && <p className="py-8 text-center text-danger text-sm">{error}</p>}
          {hits !== null && hits.length === 0 && !error && (
            <p className="py-10 text-center text-text-dim text-sm">{t('finder.empty')}</p>
          )}

          {hits !== null && hits.length > 0 && (
            <ul
              className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto" /* design-allow: 50vh tracks viewport height, no token fits */
            >
              {hits.map((h) => (
                <li key={h.id}>
                  <Button
                    variant="bare"
                    onClick={() => onPick(h)}
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-surface"
                  >
                    <Music className="size-4 shrink-0 text-text-dim" strokeWidth={1.5} />
                    <span className="min-w-0 flex-1">
                      <Text as="span" variant="item" className="block">
                        {h.trackName}
                      </Text>
                      <Text as="span" variant="hint" className="block truncate">
                        {h.artistName}
                        {h.albumName ? ` · ${h.albumName}` : ''} · {fmtDur(h.duration)}
                      </Text>
                    </span>
                    <span
                      className={`shrink-0 rounded-control px-1.5 py-0.5 text-xs ${
                        h.syncedLyrics
                          ? 'bg-accent/15 text-accent-soft'
                          : 'border border-border text-text-dim'
                      }`}
                    >
                      {h.syncedLyrics ? t('finder.synced') : t('finder.plain')}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Stack>

        <DialogFooter>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </DialogFooter>
      </Stack>
    </Dialog>
  )
}

export default LrclibFinderDialog
