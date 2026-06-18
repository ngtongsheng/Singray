import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportStage } from '../../../shared/types'
import { useLibraryContext } from '../context/LibraryContext'
import { StatusStrip } from './ui'

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
    return { job, title, moreCount: imports.size - 1 }
  }, [imports, songs])

  if (!importStrip) return null
  const { job, title, moreCount } = importStrip
  const stripKey = STRIP_KEY[job.stage]
  return (
    <StatusStrip pinned progress={job.progress}>
      <span className="text-text-dim">
        {stripKey ? t(stripKey) : job.stage} · {title}
      </span>
      <span className="font-medium text-accent">{Math.round(job.progress * 100)}%</span>
      {moreCount > 0 && (
        <span className="text-text-dim">{t('library.moreQueued', { count: moreCount })}</span>
      )}
    </StatusStrip>
  )
}

export default ImportStatusStrip
