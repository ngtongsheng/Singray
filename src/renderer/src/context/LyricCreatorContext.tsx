import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseLrc } from '../../../shared/lrc'
import type { LrclibHit, LrclibQuery, Lyrics, SongListItem } from '../../../shared/types'
import { inferEnds } from '../lib/inferEnds'
import { type BuildResult, buildLyrics, lyricsToText } from '../lib/lyricsText'
import { mergeAlignment } from '../lib/mergeAlignment'
import { stripIpcError } from '../lib/stripIpcError'
import { useAppContext } from './AppContext'

/** EL4: the three creator steps Ctrl+Tab / the tab bar cycle through. */
export type CreatorStep = 'text' | 'tap' | 'review'

interface Pending {
  result: BuildResult
  action: 'continue' | 'align'
  /** Step to land on once the user confirms (the tab they originally clicked). */
  landOn: CreatorStep
}

function parsedEmpty(text: string): boolean {
  return text.trim() === ''
}

interface LyricCreatorContextValue {
  song: SongListItem
  onBack: () => void
  creatorStep: CreatorStep
  setCreatorStep: (next: CreatorStep) => void
  text: string
  setText: (t: string) => void
  saved: Lyrics | null
  loaded: boolean
  hasTiming: boolean
  setSaved: (l: Lyrics) => void
  pending: Pending | null
  setPending: (p: Pending | null) => void
  aligning: boolean
  alignError: string | null
  onContinue: (landOn: CreatorStep) => void
  onAlign: () => void
  doAlign: (result: BuildResult, landOn: CreatorStep) => Promise<void>
  save: (result: BuildResult, landOn: CreatorStep) => Promise<void>
  pendingLrc: Lyrics | null
  setPendingLrc: (l: Lyrics | null) => void
  lrcError: string | null
  applyLrc: (lyrics: Lyrics) => Promise<void>
  fileRef: React.RefObject<HTMLInputElement | null>
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  finderOpen: boolean
  openFinder: () => void
  closeFinder: () => void
  finderQuery: LrclibQuery
  onPickHit: (hit: LrclibHit) => void
  cleaning: boolean
  cleanPreview: string | null
  setCleanPreview: (p: string | null) => void
  onClean: () => void
}

const LyricCreatorContext = createContext<LyricCreatorContextValue | null>(null)

interface ProviderProps {
  song: SongListItem
  children: React.ReactNode
}

/** Lyric creator (SPEC §6): step (a) text + Align, step (b) timing. */
export function LyricCreatorProvider({ song, children }: ProviderProps): React.JSX.Element {
  const { t } = useTranslation()
  const { goPlayer } = useAppContext()
  const onBack = useCallback(() => goPlayer(song), [goPlayer, song])
  const [creatorStep, setCreatorStepDirect] = useState<CreatorStep>('text')
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

  const hasTiming = useMemo(
    () => saved?.lines.some((l) => l.start !== null || l.units.some((u) => u.t !== null)) ?? false,
    [saved]
  )

  const save = useCallback(
    async (result: BuildResult, landOn: CreatorStep): Promise<void> => {
      await window.singray.lyrics.save(song.id, result.lyrics)
      setSaved(result.lyrics)
      setPending(null)
      setCreatorStepDirect(landOn)
    },
    [song.id]
  )

  const onContinue = useCallback(
    (landOn: CreatorStep): void => {
      const result = buildLyrics(text, song.language, saved)
      if (result.invalidated.length > 0) setPending({ result, action: 'continue', landOn })
      else void save(result, landOn)
    },
    [text, song.language, saved, save]
  )

  /** Align (SPEC §6.6): forced alignment fills `t`; failure is non-fatal (tap mode remains). */
  const doAlign = useCallback(
    async (result: BuildResult, landOn: CreatorStep): Promise<void> => {
      setPending(null)
      setAligning(true)
      setAlignError(null)
      try {
        // Persist the draft first so a pipeline crash still leaves valid lyrics.json.
        await window.singray.lyrics.save(song.id, result.lyrics)
        setSaved(result.lyrics)
        const lyricText = result.lyrics.lines
          .map((l) => l.text)
          .filter((line) => line !== '')
          .join('\n')
        const tokens = await window.singray.lyrics.align(song.id, lyricText)
        const merged = mergeAlignment(result.lyrics, tokens)
        const withEnds = inferEnds(merged.lyrics, song.durationSec)
        await window.singray.lyrics.save(song.id, withEnds)
        setSaved(withEnds)
        setCreatorStepDirect(landOn)
      } catch (err) {
        setAlignError(stripIpcError((err as Error).message))
      } finally {
        setAligning(false)
      }
    },
    [song.id, song.durationSec]
  )

  const onAlign = useCallback((): void => {
    const result = buildLyrics(text, song.language, saved)
    if (hasTiming) setPending({ result, action: 'align', landOn: 'tap' })
    else void doAlign(result, 'tap')
  }, [text, song.language, saved, hasTiming, doAlign])

  /** LRC import (R3.4): timestamped file → timed Lyrics, lands in the timing step for fix-up. */
  const applyLrc = useCallback(
    async (lyrics: Lyrics): Promise<void> => {
      setPendingLrc(null)
      await window.singray.lyrics.save(song.id, lyrics)
      setSaved(lyrics)
      setText(lyricsToText(lyrics))
      setCreatorStepDirect('tap')
    },
    [song.id]
  )

  /** Shared LRC ingest (file picker + LRCLIB synced hit): parse → ends → confirm-if-timing. */
  const ingestLrc = useCallback(
    (content: string): void => {
      try {
        const parsed = parseLrc(content, song.language)
        const withEnds = inferEnds(parsed, song.durationSec)
        if (hasTiming) setPendingLrc(withEnds)
        else void applyLrc(withEnds)
      } catch {
        setLrcError(t('creator.lrcInvalid'))
      }
    },
    [song.language, song.durationSec, hasTiming, applyLrc, t]
  )

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0]
      e.target.value = '' // allow re-picking the same file
      if (!file) return
      setLrcError(null)
      const reader = new FileReader()
      reader.onload = () => ingestLrc(String(reader.result))
      reader.onerror = () => setLrcError(t('creator.lrcInvalid'))
      reader.readAsText(file)
    },
    [ingestLrc, t]
  )

  /** LRCLIB pick (R3.5): synced → timed import path, plain-only → fill the textarea. */
  const onPickHit = useCallback(
    (hit: LrclibHit): void => {
      setFinderOpen(false)
      setLrcError(null)
      if (hit.syncedLyrics) ingestLrc(hit.syncedLyrics)
      else if (hit.plainLyrics) setText(hit.plainLyrics)
    },
    [ingestLrc]
  )

  /** LLM lyric cleanup (R3.6): preview a stripped/normalized version before applying. */
  const onClean = useCallback((): void => {
    setLrcError(null)
    setCleaning(true)
    window.singray.llm
      .cleanLyrics({ text, language: song.language })
      .then(setCleanPreview)
      .catch((err: Error) => setLrcError(stripIpcError(err.message)))
      .finally(() => setCleaning(false))
  }, [text, song.language])

  const setCreatorStep = useCallback(
    (next: CreatorStep): void => {
      if (next !== 'text' && creatorStep === 'text') {
        if (!loaded || parsedEmpty(text) || aligning) return
        onContinue(next)
        return
      }
      setCreatorStepDirect(next)
    },
    [creatorStep, loaded, text, aligning, onContinue]
  )

  const openFinder = useCallback(() => setFinderOpen(true), [])
  const closeFinder = useCallback(() => setFinderOpen(false), [])

  // Stable reference so LrclibFinderDialog's fetch effect doesn't refire on unrelated
  // re-renders (e.g. alignError/lrcError changes) while it's open.
  const finderQuery = useMemo(
    () => ({ title: song.title, artist: song.artists.join(', '), durationSec: song.durationSec }),
    [song.title, song.artists, song.durationSec]
  )

  const value: LyricCreatorContextValue = {
    song,
    onBack,
    creatorStep,
    setCreatorStep,
    text,
    setText,
    saved,
    loaded,
    hasTiming,
    setSaved,
    pending,
    setPending,
    aligning,
    alignError,
    onContinue,
    onAlign,
    doAlign,
    save,
    pendingLrc,
    setPendingLrc,
    lrcError,
    applyLrc,
    fileRef,
    onFile,
    finderOpen,
    openFinder,
    closeFinder,
    finderQuery,
    onPickHit,
    cleaning,
    cleanPreview,
    setCleanPreview,
    onClean
  }

  return <LyricCreatorContext.Provider value={value}>{children}</LyricCreatorContext.Provider>
}

export function useLyricCreatorContext(): LyricCreatorContextValue {
  const ctx = useContext(LyricCreatorContext)
  if (!ctx) throw new Error('useLyricCreatorContext must be used within LyricCreatorProvider')
  return ctx
}
