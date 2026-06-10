// Lyric tokenization (SPEC §4.4): CJK char = unit, Latin/digit word = unit,
// punctuation/whitespace attaches to the preceding unit's display text.

import type { LyricUnit } from './types'

const CJK = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+$/u
const WORD = /^[\p{L}\p{N}]+$/u

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function tokenizeLine(text: string): LyricUnit[] {
  const units: LyricUnit[] = []
  let run = '' // pending Latin/digit word
  let prefix = '' // punctuation seen before the first unit

  const push = (unitText: string): void => {
    units.push({ text: prefix + unitText, t: null })
    prefix = ''
  }
  const flushRun = (): void => {
    if (run) {
      push(run)
      run = ''
    }
  }

  for (const { segment } of segmenter.segment(text)) {
    if (CJK.test(segment)) {
      flushRun()
      push(segment)
    } else if (WORD.test(segment)) {
      run += segment
    } else {
      flushRun()
      const last = units[units.length - 1]
      if (last) last.text += segment
      else prefix += segment
    }
  }
  flushRun()
  return units
}
