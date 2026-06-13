import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { purgeLegacyWaCreds } from './lib/localStorage'

// WildApricot credentials were once cached in localStorage; they are
// server-side only now. Clean up any browser that still has them.
purgeLegacyWaCreds()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error(
    'Root element with id="root" not found. Check your index.html.'
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
