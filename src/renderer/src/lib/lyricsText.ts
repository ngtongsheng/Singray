// Text-step helpers (SPEC §6.2): textarea text ⇄ Lyrics, with a line-level diff
// that keeps timing on unchanged lines when re-editing after timing exists.

import { tokenizeLine } from '../../../shared/tokenize'
import type { Language, LyricLine, Lyrics } from '../../../shared/types'

/** Flatten lyrics back to editable text; break markers become empty rows. */
export function lyricsToText(lyrics: Lyrics): string {
  return lyrics.lines.map((l) => l.text).join('\n')
}

/**
 * Textarea → ordered line texts. Rows are trimmed; an empty row is a break
 * marker (''). Consecutive empties collapse to one break, leading/trailing
 * empties are dropped.
 */
export function parseLineTexts(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(line)
  }
  while (out[out.length - 1] === '') out.pop()
  return out
}

function lineHasTiming(line: LyricLine): boolean {
  return line.start !== null || line.units.some((u) => u.t !== null)
}

function freshLine(text: string): LyricLine {
  return { start: null, end: null, text, units: text === '' ? [] : tokenizeLine(text) }
}

/** Longest-common-subsequence match of old line texts against new ones. */
function lcsMatch(oldTexts: string[], newTexts: string[]): Map<number, number> {
  const n = oldTexts.length
  const m = newTexts.length
  // dp(i, j) = LCS length of oldTexts[i..] vs newTexts[j..], flat row-major
  const width = m + 1
  const table = new Int32Array((n + 1) * width)
  const dp = (i: number, j: number): number => table[i * width + j] ?? 0
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        oldTexts[i] === newTexts[j] ? dp(i + 1, j + 1) + 1 : Math.max(dp(i + 1, j), dp(i, j + 1))
    }
  }
  const match = new Map<number, number>() // newIndex → oldIndex
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (oldTexts[i] === newTexts[j]) {
      match.set(j, i)
      i++
      j++
    } else if (dp(i + 1, j) >= dp(i, j + 1)) i++
    else j++
  }
  return match
}

export interface BuildResult {
  lyrics: Lyrics
  /** Previously timed lines whose timing is lost by this edit. */
  invalidated: string[]
}

/**
 * Build a Lyrics draft from textarea text. Lines whose text is unchanged
 * (matched by LCS against `prev`) carry their old timing over verbatim;
 * edited/new lines start untimed (`t: null`).
 */
export function buildLyrics(text: string, language: Language, prev: Lyrics | null): BuildResult {
  const newTexts = parseLineTexts(text)
  const prevLines = prev?.lines ?? []
  const match = lcsMatch(
    prevLines.map((l) => l.text),
    newTexts
  )

  const lines = newTexts.map((t, j) => {
    const oldIdx = match.get(j)
    const old = oldIdx !== undefined ? prevLines[oldIdx] : undefined
    return old ?? freshLine(t)
  })

  const kept = new Set(match.values())
  const invalidated = prevLines
    .filter((l, i) => !kept.has(i) && lineHasTiming(l))
    .map((l) => l.text)

  return { lyrics: { schemaVersion: 1, language, lines }, invalidated }
}
