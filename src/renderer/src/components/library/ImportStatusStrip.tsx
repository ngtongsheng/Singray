import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportStage } from '../../../../shared/types'
import { useLibraryContext } from '../../context/LibraryContext'
import { StatusStrip, Tooltip } from '../ui'

const STRIP_KEY: Partial<Record<ImportStage, string>> = {
  queued: 'stage.queued',
  download: 'stage.download',
  separate: 'stage.separateLong',
  convert: 'stage.convert'
}

/** Pinned bottom strip showing the active/most-relevant import job's progress. */
function ImportStatusStrip(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { songs, imports } = useLibraryContext()

  const importStrip = useMemo(() => {
    if (imports.size === 0) return null
    const activeJob = [...imports.values()].find((p) => p.stage !== 'queued')
    const job = activeJob ?? [...imports.values()][0]
    if (!job) return null
    const title = songs.find((s) => s.id === job.songId)?.title ?? job.songId
    const queued = [...imports.values()]
      .filter((p) => p.stage === 'queued' && p.songId !== job.songId)
      .slice(0, 5)
      .map((p) => songs.find((s) => s.id === p.songId)?.title ?? p.songId)
    return { job, title, moreCount: imports.size - 1, queued }
  }, [imports, songs])

  if (!importStrip) return null
  const { job, title, moreCount, queued } = importStrip
  const stripKey = STRIP_KEY[job.stage]
  return (
    <StatusStrip pinned progress={job.progress}>
      <span className="text-muted-foreground">
        {stripKey ? t(stripKey) : job.stage} · {title}
      </span>
      <span className="font-medium text-primary">{Math.round(job.progress * 100)}%</span>
      {moreCount > 0 && (
        <Tooltip
          side="top"
          content={
            queued.length > 0 ? (
              <ul className="space-y-0.5">
                {queued.map((q) => (
                  <li key={q}>{q}</li>
                ))}
                {moreCount > queued.length && <li className="text-muted-foreground">…</li>}
              </ul>
            ) : undefined
          }
        >
          <span className="cursor-default text-muted-foreground">
            {t('library.moreQueued', { count: moreCount })}
          </span>
        </Tooltip>
      )}
    </StatusStrip>
  )
}

export default ImportStatusStrip
