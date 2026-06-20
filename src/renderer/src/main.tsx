import './assets/main.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { scan } from 'react-scan' // ponytail: dev-only perf overlay, tree-shaken in prod
import { tokenizeLine } from '../../shared/tokenize'
import App from './App'
import { AppProvider } from './context/AppContext'
import { SETTINGS_KEY } from './hooks/useSettings'
import { AudioEngine } from './lib/audioEngine'
import { initI18n, resolveLocale } from './lib/i18n'
import { createMockBridge } from './lib/mockBridge'
import { queryClient } from './lib/queryClient'

scan({ enabled: import.meta.env.DEV })

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
// Pre-populate QueryClient so first useSettings() render is synchronous (no null flash).
window.singray.settings.get().then((settings) => {
  queryClient.setQueryData(SETTINGS_KEY, settings)
  initI18n(resolveLocale(settings.uiLanguage))
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <App />
        </AppProvider>
      </QueryClientProvider>
    </StrictMode>
  )
})
