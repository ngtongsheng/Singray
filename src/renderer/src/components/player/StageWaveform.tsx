import { usePeakCanvas } from '../../hooks/usePeakCanvas'

interface Props {
  /** Normalized 0..1 max-abs peak buckets of the full mix. */
  peaks: Float32Array
  duration: number
  /** Audible position in seconds (latency-compensated engine clock). */
  clock: () => number
}

/**
 * Stage waveform (creator-style): whole-song peaks drawn once to a dim base and
 * an accent copy; each frame blits the accent copy clipped to the playhead and
 * draws the playhead line. Paint-only absolute overlay, no layout impact.
 */
function StageWaveform({ peaks, duration, clock }: Props): React.JSX.Element {
  const canvasRef = usePeakCanvas({ peaks, duration, clock })
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
}

export default StageWaveform
