import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import App from './App'

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const runtime = window as Window & {
    $RefreshSig$?: () => (type: unknown) => unknown
    $RefreshReg$?: (type: unknown, id: string) => void
  }
  if (typeof runtime.$RefreshSig$ !== 'function') {
    runtime.$RefreshSig$ = () => (type) => type
  }
  if (typeof runtime.$RefreshReg$ !== 'function') {
    runtime.$RefreshReg$ = () => {}
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
