import type { Language, LanguageDef } from '../../../shared/types'

const SCRIPT_RANGES: Array<{ lang: string; re: RegExp }> = [
  // Hiragana/Katakana → Japanese (checked before Han, since ja text also contains kanji)
  { lang: 'ja', re: /[぀-ヿ]/ },
  { lang: 'ko', re: /[가-힣ᄀ-ᇿ]/ },
  { lang: 'zh', re: /[一-鿿]/ },
  { lang: 'en', re: /[a-zA-Z]/ }
]

/**
 * ADD3: dominant-script heuristic — counts characters per script and maps the winner to a
 * language code in the user's list. Returns null when no script wins or the matching
 * language isn't in `languages` (caller keeps the existing default).
 */
export function detectLanguage(text: string, languages: LanguageDef[]): Language | null {
  const counts = new Map<string, number>()
  for (const ch of text) {
    for (const { lang, re } of SCRIPT_RANGES) {
      if (re.test(ch)) {
        counts.set(lang, (counts.get(lang) ?? 0) + 1)
        break
      }
    }
  }
  if (counts.size === 0) return null
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const topLang = top?.[0]
  return topLang !== undefined && languages.some((l) => l.code === topLang) ? topLang : null
}
