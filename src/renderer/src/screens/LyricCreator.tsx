import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Lyrics, SongListItem } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import TimingStep from '../components/TimingStep'
import { type BuildResult, buildLyrics, lyricsToText } from '../lib/lyricsText'

interface Props {
  song: SongListItem
  onBack: () => void
}

/** Lyric creator (SPEC §6): step (a) text. Step (b) timing lands in S2.3. */
function LyricCreator({ song, onBack }: Props): React.JSX.Element {
  const [step, setStep] = useState<'text' | 'timing'>('text')
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Lyrics | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<BuildResult | null>(null)

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
    if (result.invalidated.length > 0) setPending(result)
    else void save(result)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-border border-b bg-bg px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          title="Back to library"
          className="rounded-control border border-border p-2 text-text-dim hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-base">{song.title}</h1>
          <p className="truncate text-text-dim text-xs">{song.artist} · Lyrics</p>
        </div>
        <div className="flex-1" />
        {step === 'text' ? (
          <button
            type="button"
            onClick={onContinue}
            disabled={!loaded || parsedEmpty(text)}
            className="flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 font-medium text-sm text-text hover:bg-accent-soft disabled:opacity-50"
          >
            Continue <ArrowRight className="size-4" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep('text')}
            className="rounded-control border border-border px-4 py-2 text-sm hover:bg-surface"
          >
            Edit text
          </button>
        )}
      </header>

      {step === 'text' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
          <p className="text-text-dim text-xs">
            One lyric line per row · empty row = instrumental break
            {hasTiming && (
              <span className="text-accent-soft"> · editing a timed line clears its timing</span>
            )}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!loaded}
            spellCheck={false}
            placeholder={'不是想怎么来就怎么活\nBut I wanna go home\n\n(empty row = break)'}
            className="min-h-0 flex-1 resize-none rounded-card border border-border bg-surface p-4 font-lyric text-base leading-7 placeholder:text-text-dim/40"
          />
        </div>
      ) : (
        saved && <TimingStep songId={song.id} lyrics={saved} onChange={setSaved} />
      )}

      {pending && (
        <ConfirmDialog
          title="Discard timing on edited lines?"
          body={`${pending.invalidated.length} timed line${
            pending.invalidated.length === 1 ? '' : 's'
          } changed and will need re-tapping, starting with "${pending.invalidated[0]}".`}
          confirmLabel="Discard timing"
          onConfirm={() => void save(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

function parsedEmpty(text: string): boolean {
  return text.trim() === ''
}

export default LyricCreator
