import { Pause, Play } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lyrics } from '../../../../shared/types'
import { useTapTimingCursor } from '../../hooks/useTapTimingCursor'
import { Button, IconButton, Slider, Stack, StatusStrip } from '../ui'
import ReviewPane from './ReviewPane'
import WaveformStrip from './WaveformStrip'

interface Props {
  songId: string
  lyrics: Lyrics
  /** Sync every stamp up to the creator's state; persistence happens here (debounced). */
  onChange: (next: Lyrics) => void
  /** Review toggle is lifted to the creator (EL4) so Ctrl+Tab can cycle it as a step. */
  review: boolean
}

const RATES = [0.5, 0.7, 0.85, 1] as const

function fmt(t: number): string {
  const m = Math.floor(t / 60)
  return `${m}:${(t % 60).toFixed(1).padStart(4, '0')}`
}

type LyricLine = Lyrics['lines'][number]

/** EL2: tri-color timestamp — dim `—` (untimed), amber (partial), success (fully timed). */
function lineTimestamp(line: LyricLine): string {
  const firstTimed = line.units.find((u) => u.t !== null)?.t
  return firstTimed != null ? fmt(line.start ?? firstTimed) : '—'
}

function lineTimestampClass(line: LyricLine): string {
  const timed = line.units.filter((u) => u.t !== null).length
  if (timed === 0) return 'text-muted-foreground'
  return timed === line.units.length ? 'text-success' : 'text-warning'
}

/** Tap-along timing step (SPEC §6.3): Space stamps, original.m4a as reference. */
function TimingStep({ songId, lyrics, onChange, review }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const {
    playing,
    setPlaying,
    time,
    duration,
    setDuration,
    rateIdx,
    flatUnits,
    stamps,
    cursor,
    currentLine,
    done,
    progressPct,
    lineStartIdx,
    togglePlay,
    seekTo,
    jumpToLine,
    registerLineRef
  } = useTapTimingCursor({ songId, lyrics, onChange, review, audioRef })

  return (
    <Stack direction="column" className="min-h-0 flex-1">
      {/* biome-ignore lint/a11y/useMediaCaption: timing reference track; the lyrics ARE the captions being authored */}
      <audio
        ref={audioRef}
        src={window.singray.audio.url(songId, 'original')}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <Stack gap={4} className="border-border border-b px-6 py-3">
        <IconButton
          variant="primary"
          size="md"
          onClick={(e) => {
            togglePlay()
            e.currentTarget.blur()
          }}
          title={playing ? t('timing.pauseTip') : t('timing.playTip')}
        >
          {playing ? (
            <Pause className="size-5" strokeWidth={2} />
          ) : (
            <Play className="size-5" strokeWidth={2} />
          )}
        </IconButton>
        <span className="font-semibold text-2xl tabular-nums">{fmt(time)}</span>
        <Slider
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(time, duration)}
          onChange={seekTo}
          onMouseUp={(e) => e.currentTarget.blur()}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground tabular-nums">{fmt(duration)}</span>
        <span className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground tabular-nums">
          {RATES[rateIdx]}×
        </span>
      </Stack>
      <WaveformStrip songId={songId} audioRef={audioRef} stamps={stamps} onSeek={seekTo} />
      {review ? (
        <ReviewPane lyrics={lyrics} audioRef={audioRef} onSeek={seekTo} />
      ) : (
        <>
          <Stack justify="center" className="min-h-28 px-6 py-6 border-border border-b">
            <p className="max-w-full text-center font-lyric text-4xl leading-snug">
              {lyrics.lines[currentLine]?.units.map((u, ui) => {
                const idx = (lineStartIdx[currentLine] ?? 0) + ui
                return (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: unit order is stable for a given line
                    key={ui}
                    className={
                      idx < cursor
                        ? 'text-lyric-sung'
                        : idx === cursor
                          ? 'border-primary border-b-2 text-lyric-active'
                          : 'text-lyric-pending/50'
                    }
                  >
                    {u.text}
                  </span>
                )
              })}
            </p>
          </Stack>

          <Stack
            direction="column"
            gap={1}
            className="min-h-0 flex-1 overflow-y-auto pl-6 pr-[14px] pb-4" // design-allow: scrollbar-gutter compensation, see Container.tsx
          >
            {lyrics.lines.map((line, li) =>
              line.units.length === 0 ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable while timing
                <div key={li} className="px-3 py-1 text-muted-foreground/40 tracking-widest">
                  · · ·
                </div>
              ) : (
                <Button
                  // biome-ignore lint/suspicious/noArrayIndexKey: line order is stable while timing
                  key={li}
                  variant="bare"
                  ref={(el) => registerLineRef(li, el)}
                  tabIndex={-1}
                  onClick={(e) => {
                    jumpToLine(li)
                    e.currentTarget.blur()
                  }}
                  className={`flex w-full items-baseline gap-3 rounded-md px-3 py-1 text-left font-lyric text-base hover:bg-card ${
                    li === currentLine && !done ? '' : 'opacity-40'
                  }`}
                >
                  <span
                    className={`w-14 shrink-0 text-xs tabular-nums ${lineTimestampClass(line)}`}
                  >
                    {lineTimestamp(line)}
                  </span>
                  <span className={li === currentLine && !done ? 'text-lyric-active' : ''}>
                    {line.text}
                  </span>
                </Button>
              )
            )}
          </Stack>
        </>
      )}
      <StatusStrip progress={progressPct / 100} className="h-8">
        {done ? (
          <span className="font-medium text-success">{t('timing.done')}</span>
        ) : (
          <>
            <span className="text-muted-foreground">
              {stamps.length}/{flatUnits.length}
            </span>
            <span className="font-medium text-primary">{progressPct}%</span>
          </>
        )}
      </StatusStrip>
      {/* Keyboard shortcuts (permanent — no dismiss button) */}
      <Stack className="border-border border-t bg-card px-6 py-2 text-muted-foreground text-xs">
        <Stack gap={5}>
          {review ? (
            <Hint k="Space / Enter" label={t('timing.hintPlay')} />
          ) : (
            <>
              <Hint k="Space" label={t('timing.hintStamp')} />
              <Hint k="⌫" label={t('timing.hintUndo')} />
              {stamps.length > 0 && stamps.length < flatUnits.length && (
                <Hint k="Tab" label={t('timing.hintGap')} />
              )}
              <Hint k="Enter" label={t('timing.hintPlay')} />
            </>
          )}
          <Hint k="← →" label={t('timing.hintSeek')} />
          <Hint k="↑ ↓" label={t('timing.hintSpeed')} />
        </Stack>
      </Stack>
    </Stack>
  )
}

function Hint({ k, label }: { k: string; label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans">{k}</kbd>
      {label}
    </span>
  )
}

export default TimingStep
