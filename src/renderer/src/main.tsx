import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import flagFontUrl from './assets/TwemojiCountryFlags.woff2?url'
import App from './App'
import { AboutPage } from './pages/AboutPage'
import './styles/globals.css'

polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl)

const isAboutWindow = new URLSearchParams(window.location.search).get('window') === 'about'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAboutWindow ? <AboutPage /> : <App />}
  </StrictMode>
)
