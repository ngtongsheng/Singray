import { memo } from 'react'
import { usePlaybackPosition } from '../../hooks/usePlaybackClock'
import type { AudioEngine } from '../../lib/audioEngine'
import { Slider } from '../ui'

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

interface Props {
  engine: AudioEngine
  seekTip: string
}

/**
 * Timecode + seek slider, isolated from Player so the quarter-second position
 * tick only re-renders this subtree, not the whole control bar.
 */
const SeekBar = memo(function SeekBar({ engine, seekTip }: Props): React.JSX.Element {
  const position = usePlaybackPosition(engine)
  return (
    <>
      <span className="text-sm text-muted-foreground tabular-nums">{fmt(position)}</span>
      <Slider
        min={0}
        max={engine.duration}
        step={0.25}
        value={position}
        onChange={engine.seek}
        title={seekTip}
        className="h-11 flex-1"
      />
      <span className="text-sm text-muted-foreground tabular-nums">{fmt(engine.duration)}</span>
    </>
  )
})

export default SeekBar
