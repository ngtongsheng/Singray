import { memo, useState } from 'react'
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
 *
 * dragPos decouples the controlled value from the 60fps clock during drag —
 * without it, Radix's controlled Slider fights pointer events every frame.
 */
const SeekBar = memo(function SeekBar({ engine, seekTip }: Props): React.JSX.Element {
  const position = usePlaybackPosition(engine)
  const [dragPos, setDragPos] = useState<number | null>(null)
  const display = dragPos ?? position
  return (
    <>
      <span
        className={`text-sm tabular-nums transition-opacity ${dragPos !== null ? 'text-foreground opacity-60' : 'text-muted-foreground'}`}
      >
        {fmt(display)}
      </span>
      <Slider
        min={0}
        max={engine.duration}
        step={0.25}
        value={display}
        onChange={setDragPos}
        onCommit={(v) => {
          setDragPos(null)
          engine.seek(v)
        }}
        title={seekTip}
        className="h-11 flex-1"
      />
      <span className="text-sm text-muted-foreground tabular-nums">{fmt(engine.duration)}</span>
    </>
  )
})

export default SeekBar
