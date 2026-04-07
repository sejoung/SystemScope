import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import App from './App'
import { AboutPage } from './pages/AboutPage'
import './styles/globals.css'

polyfillCountryFlagEmojis('Twemoji Country Flags')

const isAboutWindow = new URLSearchParams(window.location.search).get('window') === 'about'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAboutWindow ? <AboutPage /> : <App />}
  </StrictMode>
)
