import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { tokenizeLine } from '../../shared/tokenize'
import App from './App'
import { AudioEngine } from './lib/audioEngine'

if (import.meta.env.DEV) {
  // dev-console access for eyeballing tokenization (SPEC §4.4)
  ;(window as Window & { __tokenize?: typeof tokenizeLine }).__tokenize = tokenizeLine
  // dev-console access to the audio engine (S3.1 verification before the player screen exists)
  ;(window as Window & { __AudioEngine?: typeof AudioEngine }).__AudioEngine = AudioEngine
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element missing')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
