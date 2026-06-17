/** Max-abs peak buckets across one or more decoded buffers, normalized 0..1. */
export function computePeaks(
  buffers: AudioBuffer[],
  duration: number,
  perSec: number
): Float32Array {
  const n = Math.max(1, Math.ceil(duration * perSec))
  const data = new Float32Array(n)
  for (const buf of buffers) {
    const step = buf.sampleRate / perSec
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const samples = buf.getChannelData(ch)
      for (let i = 0; i < n; i++) {
        const end = Math.min(Math.floor((i + 1) * step), samples.length)
        let m = data[i] ?? 0
        for (let j = Math.floor(i * step); j < end; j++) {
          const v = Math.abs(samples[j] ?? 0)
          if (v > m) m = v
        }
        data[i] = m
      }
    }
  }
  let max = 0
  for (const v of data) if (v > max) max = v
  if (max > 0) for (let i = 0; i < n; i++) data[i] = (data[i] ?? 0) / max
  return data
}
