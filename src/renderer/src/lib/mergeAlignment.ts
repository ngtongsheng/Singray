// Alignment merge (SPEC §6.6): whisperx tokens → unit timestamps. Confident
// matches get `t`, low-confidence/unmatched units stay null for tap fix-up.

import type { AlignToken, Lyrics } from '../../../shared/types'

/** Tokens below this confidence are treated as unmatched (stay null).
 * wav2vec2 scores run low on sung vocals — correct words land 0.35-0.9. */
const MIN_SCORE = 0.3
/** Max pieces to fuse when unit/token granularities differ ("don't" = 2 units, 1 token). */
const MAX_FUSE = 8

/** Comparable core of a unit/token: case- and punctuation-insensitive. */
function core(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export interface MergeResult {
  lyrics: Lyrics
  /** Units that received a timestamp / units that could take one. */
  matched: number
  total: number
}

/**
 * Two-pointer walk of the flat unit list against the token stream. Both come
 * from the same source text in the same order, so mismatches are granularity
 * differences (fused by concatenation on either side) or aligner noise
 * (resynced by a short lookahead). Replaces ALL existing timing.
 */
export function mergeAlignment(lyrics: Lyrics, tokens: AlignToken[]): MergeResult {
  const next = structuredClone(lyrics)
  for (const line of next.lines) {
    line.start = null
    line.end = null
    for (const u of line.units) u.t = null
  }
  const units = next.lines.flatMap((l) => l.units)
  const uCores = units.map((u) => core(u.text))
  const tCores = tokens.map((t) => core(t.text))

  let lastAssigned = -1 // monotonic guard: never let timestamps go backwards
  let matched = 0
  const assign = (unitIdx: number, tokenIdx: number): void => {
    const tok = tokens[tokenIdx]
    const unit = units[unitIdx]
    if (!tok || !unit || tok.start === null || (tok.score ?? 0) < MIN_SCORE) return
    if (tok.start < lastAssigned) return
    unit.t = tok.start
    lastAssigned = tok.start
    matched++
  }

  let i = 0
  let j = 0
  while (i < units.length && j < tokens.length) {
    const u = uCores[i] ?? ''
    if (u === '') {
      i++ // punctuation-only unit: nothing to align
      continue
    }
    const t = tCores[j] ?? ''
    if (t === '') {
      j++
      continue
    }

    if (u === t) {
      assign(i, j)
      i++
      j++
      continue
    }

    // One unit = several tokens (Latin word inside a CJK song aligns per char).
    if (u.startsWith(t)) {
      let acc = t
      let k = j + 1
      while (k < tokens.length && acc.length < u.length && k - j < MAX_FUSE) {
        acc += tCores[k] ?? ''
        k++
      }
      if (acc === u) {
        assign(i, j)
        i++
        j = k
        continue
      }
    }

    // One token = several units ("don't" tokenizes to units "don'" + "t").
    if (t.startsWith(u)) {
      let acc = u
      let k = i + 1
      while (k < units.length && acc.length < t.length && k - i < MAX_FUSE) {
        acc += uCores[k] ?? ''
        k++
      }
      if (acc === t) {
        assign(i, j) // first unit gets the time, the rest stay null
        i = k
        j++
        continue
      }
    }

    // Resync: skip the token if this unit reappears soon in the token stream,
    // else give up on the unit (stays null).
    const ahead = tCores.slice(j + 1, j + 1 + MAX_FUSE).indexOf(u)
    if (ahead !== -1) j += ahead + 1
    else i++
  }

  // Line start follows the data model: first unit's t.
  for (const line of next.lines) {
    if (line.units.length > 0) line.start = line.units[0]?.t ?? null
  }

  return { lyrics: next, matched, total: uCores.filter((c) => c !== '').length }
}
