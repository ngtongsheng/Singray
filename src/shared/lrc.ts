// LRC import (R3.4): parse plain and enhanced (word-timestamped) .lrc into the
// Lyrics model. Plain LRC carries only line starts → per-unit times are linearly
// interpolated within each line and marked `estimated`. Enhanced `<mm:ss.xx>`
// word timestamps anchor units; units between anchors are interpolated. Line ends
// are left null here and filled by inferEnds (same path as tap/align).

import { tokenizeLine } from './tokenize'
import type { Language, LyricLine, Lyrics, LyricUnit } from './types'

/** Leading line timestamp `[mm:ss.xx]` (one or more = repeated-line form). */
const LEAD_TS = /^\s*\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/
/** `[offset:±ms]` shifts every timestamp (positive = lyrics earlier → subtract). */
const OFFSET_TAG = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i
/** Enhanced word timestamp `<mm:ss.xx>` inside a line body. */
const WORD_TS = /<(\d+):(\d{1,2})(?:[.:](\d{1,3}))?>/g

/** Guessed per-unit duration for interpolating untimed plain-LRC units. */
const PER_UNIT_SEC = 0.4
/** Gap between a line's last unit and the next line that earns a break marker. */
const MIN_BREAK_GAP = 5

function toSeconds(min: string, sec: string, frac: string | undefined): number {
  const f = frac ? Number(frac.padEnd(3, '0').slice(0, 3)) / 1000 : 0
  return Number(min) * 60 + Number(sec) + f
}

interface Entry {
  start: number
  text: string
  units: LyricUnit[]
  /** [unitIndex, absoluteSeconds] anchors; always begins with [0, start]. */
  anchors: Array<[number, number]>
}

/** Pull `<ts>` word markers out of a line body → plain text + (unitIndex, time) anchors. */
function splitWords(body: string): { plain: string; words: Array<[number, number]> } {
  WORD_TS.lastIndex = 0
  let plain = ''
  let last = 0
  const words: Array<[number, number]> = []
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard global-regex exec loop
  while ((m = WORD_TS.exec(body)) !== null) {
    plain += body.slice(last, m.index)
    const unitIdx = plain.trim() === '' ? 0 : tokenizeLine(plain).length
    words.push([unitIdx, toSeconds(m[1] as string, m[2] as string, m[3])])
    last = WORD_TS.lastIndex
  }
  plain += body.slice(last)
  return { plain, words }
}

/** Fill `t` for every unit by linear interpolation between anchors; mark interpolated ones estimated. */
function fillTimes(units: LyricUnit[], anchors: Array<[number, number]>, lineEnd: number): void {
  if (units.length === 0) return
  const byIdx = new Map<number, number>() // later anchor at the same index wins
  for (const [idx, t] of anchors) if (idx >= 0 && idx < units.length) byIdx.set(idx, t)
  const pts = [...byIdx.entries()].sort((a, b) => a[0] - b[0])
  if (pts.length === 0) pts.push([0, anchors[0]?.[1] ?? 0])
  pts.push([units.length, Math.max(lineEnd, (pts[pts.length - 1]?.[1] ?? 0) + 0.1)])
  for (let k = 0; k < pts.length - 1; k++) {
    const [ai, at] = pts[k] as [number, number]
    const [bi, bt] = pts[k + 1] as [number, number]
    for (let u = ai; u < bi; u++) {
      const unit = units[u]
      if (!unit) continue
      unit.t = bi === ai ? at : at + ((u - ai) / (bi - ai)) * (bt - at)
      if (u !== ai) unit.estimated = true
    }
  }
}

/**
 * Parse an .lrc file into Lyrics. Throws when no timestamped lyric line is found
 * (metadata-only / malformed file) so the caller can reject without harm.
 */
export function parseLrc(content: string, language: Language): Lyrics {
  let offsetSec = 0
  const entries: Entry[] = []

  for (const line of content.split(/\r?\n/)) {
    const off = line.match(OFFSET_TAG)
    if (off) {
      offsetSec = Number(off[1]) / 1000
      continue
    }
    let rest = line
    const starts: number[] = []
    let m = rest.match(LEAD_TS)
    while (m) {
      starts.push(toSeconds(m[1] as string, m[2] as string, m[3]))
      rest = rest.slice(m[0].length)
      m = rest.match(LEAD_TS)
    }
    if (starts.length === 0) continue // metadata tag or untimed line

    const single = starts.length === 1
    const { plain, words } = single ? splitWords(rest) : { plain: rest, words: [] }
    const text = plain.replace(WORD_TS, '').trim()
    for (const start of starts) {
      const units = text === '' ? [] : tokenizeLine(text)
      const anchors: Array<[number, number]> = [[0, start]]
      for (const [idx, t] of words) anchors.push([idx, t])
      entries.push({ start, text, units, anchors })
    }
  }

  if (offsetSec !== 0) {
    for (const e of entries) {
      e.start = Math.max(0, e.start - offsetSec)
      e.anchors = e.anchors.map(([i, t]) => [i, Math.max(0, t - offsetSec)])
    }
  }

  entries.sort((a, b) => a.start - b.start)
  if (entries.length === 0) throw new Error('No timestamped lyric lines found')

  const lines: LyricLine[] = []
  entries.forEach((e, i) => {
    if (e.units.length === 0) {
      lines.push({ start: null, end: null, text: '', units: [] }) // explicit instrumental marker
      return
    }
    const nextStart = entries[i + 1]?.start
    const lastAnchor = e.anchors[e.anchors.length - 1] as [number, number]
    const natural = lastAnchor[1] + (e.units.length - lastAnchor[0]) * PER_UNIT_SEC
    const lineEnd = nextStart === undefined ? natural : Math.min(nextStart, natural)
    fillTimes(e.units, e.anchors, lineEnd)
    lines.push({ start: e.units[0]?.t ?? e.start, end: null, text: e.text, units: e.units })

    const lastT = e.units[e.units.length - 1]?.t ?? e.start
    if (nextStart !== undefined && nextStart - lastT >= MIN_BREAK_GAP) {
      lines.push({ start: null, end: null, text: '', units: [] })
    }
  })

  return { schemaVersion: 1, language, lines }
}
