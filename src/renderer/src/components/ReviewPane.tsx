import { useCallback } from 'react'
import type { Lyrics } from '../../../shared/types'
import LyricRenderer from './LyricRenderer'

interface Props {
  lyrics: Lyrics
  /** Shared with TimingStep's transport — review plays the same original.m4a element. */
  audioRef: React.RefObject<HTMLAudioElement | null>
  onSeek: (t: number) => void
}

/** Inline review mode (SPEC §6.7) — the real player renderer driven by the creator's transport. */
function ReviewPane({ lyrics, audioRef, onSeek }: Props): React.JSX.Element {
  const clock = useCallback(() => audioRef.current?.currentTime ?? 0, [audioRef])
  return (
    <div className="min-h-0 flex-1">
      <LyricRenderer lyrics={lyrics} clock={clock} onSeek={onSeek} showGradient={false} />
    </div>
  )
}

export default ReviewPane
