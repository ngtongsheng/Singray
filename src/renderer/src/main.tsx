import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { tokenizeLine } from '../../shared/tokenize'
import App from './App'

if (import.meta.env.DEV) {
  // dev-console access for eyeballing tokenization (SPEC §4.4)
  ;(window as Window & { __tokenize?: typeof tokenizeLine }).__tokenize = tokenizeLine
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element missing')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
