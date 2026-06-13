import { ArrowLeft, ArrowRight, FileDown, Loader2, Search, Sparkles, Wand2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseLrc } from '../../../shared/lrc'
import type { LrclibHit, Lyrics, SongListItem } from '../../../shared/types'
import CleanLyricsDialog from '../components/CleanLyricsDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import LrclibFinderDialog from '../components/LrclibFinderDialog'
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
              className="app-no-drag font-medium text-text-dim hover:text-text"
            >
              <Search className="size-4" strokeWidth={1.5} /> {t('finder.find')}
            </Button>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={!loaded || aligning}
              title={t('creator.importLrcTip')}
              className="app-no-drag font-medium text-text-dim hover:text-text"
            >
              <FileDown className="size-4" strokeWidth={1.5} /> {t('creator.importLrc')}
            </Button>
            <Button
              onClick={() => void onClean()}
              disabled={!loaded || parsedEmpty(text) || cleaning || aligning}
              title={t('clean.tip')}
              className="app-no-drag font-medium text-text-dim hover:text-text"
            >
              {cleaning ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} /> {t('clean.cleaning')}
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
          {lrcError && <p className="text-danger text-xs">{lrcError}</p>}
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
