import { Loader2, Music } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LrclibHit, LrclibQuery } from '../../../shared/types'
import { Button } from './ui'
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
    <Dialog label={t('finder.title')} width="w-[460px]" onClose={onClose}>
      <h2 className="mb-1 font-semibold text-lg">{t('finder.title')}</h2>
      <p className="mb-4 text-text-dim text-xs">
        {t('finder.subtitle', { title: query.title, artist: query.artist })}
      </p>

      {hits === null && !error && (
        <div className="flex items-center justify-center gap-2 py-10 text-text-dim text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} /> {t('finder.searching')}
        </div>
      )}
      {error && <p className="py-8 text-center text-danger text-sm">{error}</p>}
      {hits !== null && hits.length === 0 && !error && (
        <p className="py-10 text-center text-text-dim text-sm">{t('finder.empty')}</p>
      )}

      {hits !== null && hits.length > 0 && (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {hits.map((h) => (
            <li key={h.id}>
              <Button
                variant="bare"
                onClick={() => onPick(h)}
                className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-surface"
              >
                <Music className="size-4 shrink-0 text-text-dim" strokeWidth={1.5} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sm">{h.trackName}</span>
                  <span className="block truncate text-text-dim text-xs">
                    {h.artistName}
                    {h.albumName ? ` · ${h.albumName}` : ''} · {fmtDur(h.duration)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-control px-1.5 py-0.5 text-[10px] ${
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

      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </div>
    </Dialog>
  )
}

export default LrclibFinderDialog
