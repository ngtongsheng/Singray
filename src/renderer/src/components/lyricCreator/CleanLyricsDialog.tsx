import { clsx as cx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { diffLines } from '../../lib/lineDiff'
import { Button, DialogFooter, ScrollArea, Stack, Text } from '../ui'
import Dialog from '../ui/Dialog'

interface Props {
  original: string
  cleaned: string
  onApply: () => void
  onClose: () => void
}

/** Lyric cleanup preview (R3.6 / AIC1): unified inline diff, removed lines marked red, apply to confirm. */
function CleanLyricsDialog({ original, cleaned, onApply, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const before = original.split('\n').filter((l) => l.trim() !== '')
  const after = cleaned.split('\n').filter((l) => l.trim() !== '')
  const diff = diffLines(before, after)
  const removed = diff.filter((op) => op.type === 'removed').length
  const majorRemoval = before.length > 0 && removed / before.length > 0.4

  return (
    <Dialog label={t('clean.title')} width="lg" onClose={onClose}>
      <Stack direction="column" gap={5}>
        <Stack direction="column" gap={4}>
          <Stack direction="column" gap={1}>
            <Text as="h2" variant="title">
              {t('clean.title')}
            </Text>
            <Text
              variant={majorRemoval ? 'error' : 'hint'}
              className={majorRemoval ? 'font-semibold' : undefined}
            >
              {majorRemoval
                ? t('clean.majorRemoval', { count: removed, total: before.length })
                : removed > 0
                  ? t('clean.removed', { count: removed })
                  : t('clean.noChanges')}
            </Text>
          </Stack>
          <ScrollArea
            className="h-[55vh] rounded-lg border border-border bg-card font-lyric text-sm leading-6" /* design-allow: 55vh tracks viewport height, no token fits */
          >
            <div className="whitespace-pre-wrap p-3">
              {diff.map((op, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static preview snapshot
                  key={i}
                  className={cx(
                    op.type === 'removed' && 'text-destructive line-through',
                    op.type === 'added' && 'text-success'
                  )}
                >
                  <span className="inline-block w-4 select-none text-muted-foreground/50">
                    {op.type === 'removed' ? '−' : op.type === 'added' ? '+' : ''}
                  </span>
                  {op.line}
                </div>
              ))}
            </div>
          </ScrollArea>
        </Stack>
        <DialogFooter gap={2}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={onApply}>
            {t('clean.apply')}
          </Button>
        </DialogFooter>
      </Stack>
    </Dialog>
  )
}

export default CleanLyricsDialog
