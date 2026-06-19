import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { tokenizeLine } from '../../shared/tokenize'
import App from './App'
import { AppProvider } from './context/AppContext'
import { AudioEngine } from './lib/audioEngine'
import { initI18n, resolveLocale } from './lib/i18n'
import { createMockBridge } from './lib/mockBridge'

if (import.meta.env.DEV && !window.singray) {
  // Browser dev (localhost:5173): no Electron preload, so window.singray is
  // undefined and the first settings.get() would throw → blank page. Install a
  // fixture mock so the renderer runs standalone for component dev + react-scan.
  window.singray = createMockBridge()
}

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
      <AppProvider>
        <App />
      </AppProvider>
    </StrictMode>
  )
})
