import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Fit the 402×874 phone frame inside the window (never upscale).
const fit = () => {
  const k = Math.min(1, (innerWidth - 24) / 402, (innerHeight - 24) / 874)
  document.documentElement.style.setProperty('--k', String(Math.max(0.3, k)))
}
fit()
addEventListener('resize', fit)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
