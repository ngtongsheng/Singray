import {
  ArrowLeft,
  ArrowRight,
  Eye,
  FileDown,
  FileText,
  Keyboard,
  Loader2,
  Search,
  Sparkles,
  Wand2
} from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseLrc } from '../../../shared/lrc'
import type { LrclibHit, Lyrics, SongListItem } from '../../../shared/types'
import CleanLyricsDialog from '../components/CleanLyricsDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import LrclibFinderDialog from '../components/LrclibFinderDialog'
import TimingStep from '../components/TimingStep'
import { Button, IconButton, Segmented, Stack, Text, useTabCycle } from '../components/ui'
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

/** EL4: the three creator steps Ctrl+Tab / the tab bar cycle through. `review` is a toggle within `timing`, not its own route. */
type CreatorStep = 'text' | 'tap' | 'review'
const CREATOR_STEPS = ['text', 'tap', 'review'] as const

/** Lyric creator (SPEC §6): step (a) text + Align, step (b) timing. */
function LyricCreator({ song, onBack }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [step, setStep] = useState<'text' | 'timing'>('text')
  const [review, setReview] = useState(false)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Lyrics | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [aligning, setAligning] = useState(false)
  const [alignError, setAlignError] = useState<string | null>(null)
  const [pendingLrc, setPendingLrc] = useState<Lyrics | null>(null)
  const [lrcError, setLrcError] = useState<string | null>(null)
  const [finderOpen, setFinderOpen] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanPreview, setCleanPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  /** LRC import (R3.4): timestamped file → timed Lyrics, lands in the timing step for fix-up. */
  const applyLrc = async (lyrics: Lyrics): Promise<void> => {
    setPendingLrc(null)
    await window.singray.lyrics.save(song.id, lyrics)
    setSaved(lyrics)
    setText(lyricsToText(lyrics))
    setStep('timing')
  }

  /** Shared LRC ingest (file picker + LRCLIB synced hit): parse → ends → confirm-if-timing. */
  const ingestLrc = (content: string): void => {
    try {
      const parsed = parseLrc(content, song.language)
      const withEnds = inferEnds(parsed, song.durationSec)
      if (hasTiming) setPendingLrc(withEnds)
      else void applyLrc(withEnds)
    } catch {
      setLrcError(t('creator.lrcInvalid'))
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setLrcError(null)
    const reader = new FileReader()
    reader.onload = () => ingestLrc(String(reader.result))
    reader.onerror = () => setLrcError(t('creator.lrcInvalid'))
    reader.readAsText(file)
  }

  /** LRCLIB pick (R3.5): synced → timed import path, plain-only → fill the textarea. */
  const onPickHit = (hit: LrclibHit): void => {
    setFinderOpen(false)
    setLrcError(null)
    if (hit.syncedLyrics) ingestLrc(hit.syncedLyrics)
    else if (hit.plainLyrics) setText(hit.plainLyrics)
  }

  /** LLM lyric cleanup (R3.6): preview a stripped/normalized version before applying. */
  const onClean = async (): Promise<void> => {
    setLrcError(null)
    setCleaning(true)
    try {
      const cleaned = await window.singray.llm.cleanLyrics({ text, language: song.language })
      setCleanPreview(cleaned)
    } catch (err) {
      setLrcError(
        (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      )
    } finally {
      setCleaning(false)
    }
  }

  /** EL4: derive the current step from `step` + `review` and translate cycle moves back into them. */
  const creatorStep: CreatorStep = step === 'text' ? 'text' : review ? 'review' : 'tap'

  const setCreatorStep = (next: CreatorStep): void => {
    if (next === 'text') {
      setReview(false)
      setStep('text')
      return
    }
    if (step === 'text') {
      if (!loaded || parsedEmpty(text) || aligning) return
      onContinue()
    }
    setReview(next === 'review')
  }

  useTabCycle(CREATOR_STEPS, creatorStep, setCreatorStep)

  return (
    <div className="relative h-full">
      {/* Content starts below the floating AppHeader (pt-19) */}
      <Stack direction="column" gap={0} className="absolute inset-0 pt-19">
        {/* Row 1: Header — left: back + title, right: Segmented + Continue */}
        <Stack as="header" justify="between" className="app-no-drag border-border border-b px-6">
          <Stack gap={2} align="center" className="min-w-0">
            <IconButton
              onClick={onBack}
              title={t('common.back')}
              className="shrink-0 text-text-dim hover:text-text"
            >
              <ArrowLeft className="size-4" strokeWidth={1.5} />
            </IconButton>
            <Stack gap={2} align="baseline" className="min-w-0">
              <Text as="h1" variant="subtitle" className="truncate">
                {song.title}
              </Text>
              <Text variant="hint" className="hidden truncate sm:inline">
                {t('creator.subtitle', { artist: song.artist })}
              </Text>
            </Stack>
          </Stack>
          <Stack gap={3} align="center" className="shrink-0">
            <Segmented
              value={creatorStep}
              onChange={setCreatorStep}
              options={[
                {
                  value: 'text',
                  label: (
                    <>
                      <FileText className="size-4" strokeWidth={1.5} /> {t('creator.stepText')}
                    </>
                  )
                },
                {
                  value: 'tap',
                  label: (
                    <>
                      <Keyboard className="size-4" strokeWidth={1.5} /> {t('creator.stepTap')}
                    </>
                  )
                },
                {
                  value: 'review',
                  label: (
                    <>
                      <Eye className="size-4" strokeWidth={1.5} /> {t('creator.stepReview')}
                    </>
                  )
                }
              ]}
            />
            {step === 'text' && (
              <Button
                variant="primary"
                onClick={onContinue}
                disabled={!loaded || parsedEmpty(text) || aligning}
              >
                {t('creator.continue')} <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Row 2: Action buttons (text step only) */}
        {step === 'text' && (
          <div className="border-border border-b px-6 py-2">
            <Stack gap={2}>
              <input
                ref={fileRef}
                type="file"
                accept=".lrc,.txt,text/plain"
                onChange={onFile}
                className="hidden"
              />
              <Button
                onClick={() => setFinderOpen(true)}
                disabled={!loaded || aligning}
                title={t('finder.findTip')}
                className="font-medium text-text-dim hover:text-text"
              >
                <Search className="size-4" strokeWidth={1.5} /> {t('finder.find')}
              </Button>
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={!loaded || aligning}
                title={t('creator.importLrcTip')}
                className="font-medium text-text-dim hover:text-text"
              >
                <FileDown className="size-4" strokeWidth={1.5} /> {t('creator.importLrc')}
              </Button>
              <Button
                onClick={() => void onClean()}
                disabled={!loaded || parsedEmpty(text) || cleaning || aligning}
                title={t('clean.tip')}
                className="font-medium text-text-dim hover:text-text"
              >
                {cleaning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} />{' '}
                    {t('clean.cleaning')}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" strokeWidth={1.5} /> {t('clean.button')}
                  </>
                )}
              </Button>
              <Button
                onClick={onAlign}
                disabled={!loaded || parsedEmpty(text) || aligning}
                title={t('creator.alignTip')}
                className="font-medium text-text-dim hover:text-text"
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
            </Stack>
            {(alignError || lrcError) && (
              <div className="mt-1">
                {alignError && (
                  <Text variant="error">{t('creator.alignFailed', { message: alignError })}</Text>
                )}
                {lrcError && <Text variant="error">{lrcError}</Text>}
              </div>
            )}
          </div>
        )}

        {/* Row 3 + 4: Content area (textarea + hint, or TimingStep) */}
        <div className="flex min-h-0 flex-1 flex-col">
          {step === 'text' ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!loaded}
                spellCheck={false}
                placeholder={t('creator.placeholder')}
                className="min-h-0 flex-1 resize-none overflow-y-auto bg-surface p-6 font-lyric text-base leading-7 placeholder:text-text-dim/40"
              />
              {/* Row 4: Helper text under textarea */}
              <div className="border-border border-t px-6 py-2">
                <Text variant="hint">
                  {t('creator.hint')}
                  {hasTiming && <span className="text-accent-soft">{t('creator.hintTimed')}</span>}
                </Text>
              </div>
            </>
          ) : (
            saved && (
              <TimingStep songId={song.id} lyrics={saved} onChange={setSaved} review={review} />
            )
          )}
        </div>
      </Stack>

      <AnimatePresence>
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
          <LrclibFinderDialog
            query={{ title: song.title, artist: song.artist, durationSec: song.durationSec }}
            onPick={onPickHit}
            onClose={() => setFinderOpen(false)}
          />
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
