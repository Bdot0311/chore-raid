import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const params = new URLSearchParams(location.search)
const portrait = params.get('portrait')

if (portrait) {
  // Tooling only: renders a character portrait (tools/portraits.cjs).
  void import('./world/portrait').then((m) => m.mountPortrait(portrait, params.get('pose') ?? 'Idle_Combat', Number(params.get('t') ?? 0.5)))
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
