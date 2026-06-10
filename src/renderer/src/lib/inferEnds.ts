import type { Lyrics } from '../../../shared/types'

export const MAX_TAIL = 5

/**
 * End inference (SPEC §6.4): tap = start only, ends are derived.
 * For every fully-stamped line: end = min(lastUnit.t + MAX_TAIL, next non-break line's start,
 * songDuration). Breaks fall out naturally — the next stamped line's start caps the tail across
 * the gap. Partially-stamped lines get end = null (recomputed on every persist, so undo heals).
 */
export function inferEnds(lyrics: Lyrics, songDuration: number): Lyrics {
  const next = structuredClone(lyrics)
  next.lines.forEach((line, i) => {
    if (line.units.length === 0) return // break marker: start/end stay null
    const lastT = line.units[line.units.length - 1]?.t ?? null
    if (line.start === null || lastT === null || line.units.some((u) => u.t === null)) {
      line.end = null
      return
    }
    let end = lastT + MAX_TAIL
    const nextStart = next.lines.slice(i + 1).find((l) => l.units.length > 0)?.start
    if (nextStart !== null && nextStart !== undefined) end = Math.min(end, nextStart)
    if (songDuration > 0) end = Math.min(end, songDuration)
    // Mis-tapped overlap guard: keep start < end valid even if the next line starts too early.
    if (end <= lastT) end = lastT + 0.2
    line.end = end
  })
  return next
}
