import { ArrowLeft, ArrowRight, Loader2, Wand2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lyrics, SongListItem } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import TimingStep from '../components/TimingStep'
import Titlebar from '../components/Titlebar'
import { Button, IconButton } from '../components/ui'
import { inferEnds } from '../lib/inferEnds'
import { type BuildResult, buildLyrics, lyricsToText } from '../lib/lyricsText'
import { mergeAlignment } from '../lib/mergeAlignment'

interface Props {
  song: SongListItem
  onBack: () => void
}

interface Pending {
  result: BuildResult
  action: 'continue' | 'align'
}

/** Lyric creator (SPEC §6): step (a) text + Align, step (b) timing. */
function LyricCreator({ song, onBack }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [step, setStep] = useState<'text' | 'timing'>('text')
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Lyrics | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [aligning, setAligning] = useState(false)
  const [alignError, setAlignError] = useState<string | null>(null)

  useEffect(() => {
    window.singray.lyrics.get(song.id).then((lyrics) => {
      setSaved(lyrics)
      if (lyrics) setText(lyricsToText(lyrics))
      setLoaded(true)
    })
  }, [song.id])

  const hasTiming =
    saved?.lines.some((l) => l.start !== null || l.units.some((u) => u.t !== null)) ?? false

  const save = async (result: BuildResult): Promise<void> => {
    await window.singray.lyrics.save(song.id, result.lyrics)
    setSaved(result.lyrics)
    setPending(null)
    setStep('timing')
  }

  const onContinue = (): void => {
    const result = buildLyrics(text, song.language, saved)
    if (result.invalidated.length > 0) setPending({ result, action: 'continue' })
    else void save(result)
  }

  /** Align (SPEC §6.6): forced alignment fills `t`; failure is non-fatal (tap mode remains). */
  const doAlign = async (result: BuildResult): Promise<void> => {
    setPending(null)
    setAligning(true)
    setAlignError(null)
    try {
      // Persist the draft first so a pipeline crash still leaves valid lyrics.json.
      await window.singray.lyrics.save(song.id, result.lyrics)
      setSaved(result.lyrics)
      const lyricText = result.lyrics.lines
        .map((l) => l.text)
        .filter((t) => t !== '')
        .join('\n')
      const tokens = await window.singray.lyrics.align(song.id, lyricText)
      const merged = mergeAlignment(result.lyrics, tokens)
      const withEnds = inferEnds(merged.lyrics, song.durationSec)
      await window.singray.lyrics.save(song.id, withEnds)
      setSaved(withEnds)
      setStep('timing')
    } catch (err) {
      setAlignError(
        (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      )
    } finally {
      setAligning(false)
    }
  }

  const onAlign = (): void => {
    const result = buildLyrics(text, song.language, saved)
    if (hasTiming) setPending({ result, action: 'align' })
    else void doAlign(result)
  }

  return (
    <div className="flex h-full flex-col">
      <Titlebar>
        <IconButton
          onClick={onBack}
          title={t('common.back')}
          className="app-no-drag text-text-dim hover:text-text"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate font-semibold text-sm">{song.title}</h1>
          <p className="truncate text-text-dim text-xs">
            {t('creator.subtitle', { artist: song.artist })}
          </p>
        </div>
        <div className="flex-1" />
        {step === 'text' ? (
          <>
            <Button
              onClick={onAlign}
              disabled={!loaded || parsedEmpty(text) || aligning}
              title={t('creator.alignTip')}
              className="app-no-drag font-medium text-text-dim hover:text-text"
            >
              {aligning ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />{' '}
                  {t('creator.aligning')}
                </>
              ) : (
                <>
                  <Wand2 className="size-4" strokeWidth={1.5} /> {t('creator.align')}
                </>
              )}
            </Button>
            <Button
              variant="primary"
              onClick={onContinue}
              disabled={!loaded || parsedEmpty(text) || aligning}
              className="app-no-drag"
            >
              {t('creator.continue')} <ArrowRight className="size-4" strokeWidth={2} />
            </Button>
          </>
        ) : (
          <Button onClick={() => setStep('text')} className="app-no-drag">
            {t('creator.editText')}
          </Button>
        )}
      </Titlebar>

      {step === 'text' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
          <p className="text-text-dim text-xs">
            {t('creator.hint')}
            {hasTiming && <span className="text-accent-soft">{t('creator.hintTimed')}</span>}
          </p>
          {alignError && (
            <p className="text-danger text-xs">
              {t('creator.alignFailed', { message: alignError })}
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!loaded}
            spellCheck={false}
            placeholder={t('creator.placeholder')}
            className="min-h-0 flex-1 resize-none rounded-card border border-border bg-surface p-4 font-lyric text-base leading-7 placeholder:text-text-dim/40"
          />
        </div>
      ) : (
        saved && <TimingStep songId={song.id} lyrics={saved} onChange={setSaved} />
      )}

      <AnimatePresence>
        {pending &&
          (pending.action === 'align' ? (
            <ConfirmDialog
              title={t('creator.replaceTimingTitle')}
              body={t('creator.replaceTimingBody')}
              confirmLabel={t('creator.alignAnyway')}
              onConfirm={() => void doAlign(pending.result)}
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
              onConfirm={() => void save(pending.result)}
              onCancel={() => setPending(null)}
            />
          ))}
      </AnimatePresence>
    </div>
  )
}

function parsedEmpty(text: string): boolean {
  return text.trim() === ''
}

export default LyricCreator
