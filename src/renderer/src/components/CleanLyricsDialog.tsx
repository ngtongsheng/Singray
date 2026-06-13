import { useTranslation } from 'react-i18next'
import { Button } from './ui'
import Dialog from './ui/Dialog'

interface Props {
  original: string
  cleaned: string
  onApply: () => void
  onClose: () => void
}

/** Lyric cleanup preview (R3.6): before (removed lines struck) vs after, apply to confirm. */
function CleanLyricsDialog({ original, cleaned, onApply, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const keep = new Set(
    cleaned
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  )
  const beforeLines = original.split('\n')
  const removed = beforeLines.filter((l) => l.trim() && !keep.has(l.trim())).length

  return (
    <Dialog label={t('clean.title')} width="w-[680px]" onClose={onClose}>
      <h2 className="mb-1 font-semibold text-lg">{t('clean.title')}</h2>
      <p className="mb-4 text-text-dim text-xs">
        {removed > 0 ? t('clean.removed', { count: removed }) : t('clean.noChanges')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-text-dim text-xs">{t('clean.before')}</p>
          <div className="h-[44vh] overflow-y-auto whitespace-pre-wrap rounded-card border border-border bg-surface p-3 font-lyric text-sm leading-6">
            {beforeLines.map((l, i) => {
              const isRemoved = l.trim() !== '' && !keep.has(l.trim())
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static preview snapshot
                  key={i}
                  className={isRemoved ? 'text-danger line-through opacity-60' : ''}
                >
                  {l || ' '}
                </div>
              )
            })}
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-accent-soft text-xs">{t('clean.after')}</p>
          <div className="h-[44vh] overflow-y-auto whitespace-pre-wrap rounded-card border border-border bg-surface p-3 font-lyric text-sm leading-6">
            {cleaned || ' '}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={onApply}>
          {t('clean.apply')}
        </Button>
      </div>
    </Dialog>
  )
}

export default CleanLyricsDialog
