import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { tokenizeLine } from '../../shared/tokenize'
import App from './App'
import { AudioEngine } from './lib/audioEngine'
import { initI18n, resolveLocale } from './lib/i18n'

if (import.meta.env.DEV) {
  // dev-console access for eyeballing tokenization (SPEC §4.4)
  ;(window as Window & { __tokenize?: typeof tokenizeLine }).__tokenize = tokenizeLine
  // dev-console access to the audio engine (S3.1 verification before the player screen exists)
  ;(window as Window & { __AudioEngine?: typeof AudioEngine }).__AudioEngine = AudioEngine
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element missing')

// i18n needs the saved locale preference before first paint (R2.5).
window.singray.settings.get().then((settings) => {
  initI18n(resolveLocale(settings.uiLanguage))
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
