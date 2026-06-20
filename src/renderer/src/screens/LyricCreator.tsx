import { AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { SongListItem } from '../../../shared/types'
import CleanLyricsDialog from '../components/lyricCreator/CleanLyricsDialog'
import CreatorHeader from '../components/lyricCreator/CreatorHeader'
import LrclibFinderDialog from '../components/lyricCreator/LrclibFinderDialog'
import TextEditor from '../components/lyricCreator/TextEditor'
import TextStepToolbar from '../components/lyricCreator/TextStepToolbar'
import TimingStep from '../components/lyricCreator/TimingStep'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import Titlebar from '../components/shared/Titlebar'
import { Stack } from '../components/ui'
import { LyricCreatorProvider, useLyricCreatorContext } from '../context/LyricCreatorContext'

interface Props {
  song: SongListItem
}

function LyricCreator({ song }: Props): React.JSX.Element {
  return (
    <LyricCreatorProvider song={song}>
      <LyricCreatorView />
    </LyricCreatorProvider>
  )
}

function LyricCreatorView(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    song,
    creatorStep,
    saved,
    setSaved,
    backGuard,
    setBackGuard,
    doBack,
    pending,
    setPending,
    pendingLrc,
    setPendingLrc,
    applyLrc,
    save,
    doAlign,
    finderOpen,
    closeFinder,
    finderQuery,
    onPickHit,
    cleanPreview,
    setCleanPreview,
    text,
    setText
  } = useLyricCreatorContext()

  return (
    <div className="relative h-full">
      {/* Row 1: Floating page header (Titlebar) — back + title (left), Segmented (right) */}
      <Titlebar>
        <CreatorHeader />
      </Titlebar>

      {/* Content area (pt-19 clears the floating AppHeader + Titlebar) */}
      <Stack direction="column" gap={0} className="absolute inset-0 pt-19">
        {creatorStep === 'text' && <TextStepToolbar />}

        {creatorStep === 'text' ? (
          <TextEditor />
        ) : (
          saved && (
            <TimingStep
              songId={song.id}
              lyrics={saved}
              onChange={setSaved}
              review={creatorStep === 'review'}
            />
          )
        )}
      </Stack>

      <AnimatePresence>
        {backGuard && (
          <ConfirmDialog
            title={t('creator.leaveTitle')}
            body={t('creator.leaveBody')}
            confirmLabel={t('creator.leave')}
            onConfirm={doBack}
            onCancel={() => setBackGuard(false)}
          />
        )}
        {cleanPreview !== null && (
          <CleanLyricsDialog
            original={text}
            cleaned={cleanPreview}
            onApply={() => {
              setText(cleanPreview)
              setCleanPreview(null)
            }}
            onClose={() => setCleanPreview(null)}
          />
        )}
        {finderOpen && (
          <LrclibFinderDialog query={finderQuery} onPick={onPickHit} onClose={closeFinder} />
        )}
        {pendingLrc && (
          <ConfirmDialog
            title={t('creator.lrcReplaceTitle')}
            body={t('creator.lrcReplaceBody')}
            confirmLabel={t('creator.lrcReplace')}
            onConfirm={() => void applyLrc(pendingLrc)}
            onCancel={() => setPendingLrc(null)}
          />
        )}
        {pending &&
          (pending.action === 'align' ? (
            <ConfirmDialog
              title={t('creator.replaceTimingTitle')}
              body={t('creator.replaceTimingBody')}
              confirmLabel={t('creator.alignAnyway')}
              onConfirm={() => void doAlign(pending.result, pending.landOn)}
              onCancel={() => setPending(null)}
            />
          ) : (
            <ConfirmDialog
              title={t('creator.discardTitle')}
              body={t('creator.discardBody', {
                count: pending.result.invalidated.length,
                first: pending.result.invalidated[0]
              })}
              confirmLabel={t('creator.discard')}
              onConfirm={() => void save(pending.result, pending.landOn)}
              onCancel={() => setPending(null)}
            />
          ))}
      </AnimatePresence>
    </div>
  )
}

export default LyricCreator
