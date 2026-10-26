import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyCachedAppearance } from './services/preferences'
import { initializeLanguageTranslations } from './services/language'

applyCachedAppearance()
initializeLanguageTranslations()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
