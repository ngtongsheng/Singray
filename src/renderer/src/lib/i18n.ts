import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

/**
 * Localisation (R2.5): one folder per language under src/renderer/locales —
 * a contributor adds a folder with translation.json and it appears in the
 * Settings language select with no code change.
 */
const modules = import.meta.glob('../../locales/*/translation.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>

const resources: Record<string, { translation: Record<string, unknown> }> = {}
for (const [path, mod] of Object.entries(modules)) {
  const code = path.split('/').at(-2)
  if (code) resources[code] = { translation: mod.default }
}

export const availableLocales = Object.keys(resources).sort()

/** Saved preference ('' = follow OS) → usable locale: OS zh* → zh, else en. */
export function resolveLocale(pref: string): string {
  if (pref && availableLocales.includes(pref)) return pref
  const osLang = navigator.language.toLowerCase().split('-')[0] ?? ''
  return availableLocales.includes(osLang) ? osLang : 'en'
}

/** Native name of a locale, read from that locale's own translation file. */
export function localeName(code: string): string {
  return i18n.getFixedT(code)('languageName')
}

export function initI18n(lng: string): void {
  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    // ponytail: dev-only; noop in prod
    ...(import.meta.env.DEV && {
      saveMissing: true,
      missingKeyHandler: (_lngs: readonly string[], _ns: string, key: string) => {
        console.warn(`[i18n] missing key: ${key}`)
      }
    })
  })
}

export { i18n }
