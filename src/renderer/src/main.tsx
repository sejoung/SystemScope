import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AboutPage } from './pages/AboutPage'
import './styles/globals.css'

const isAboutWindow = new URLSearchParams(window.location.search).get('window') === 'about'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAboutWindow ? <AboutPage /> : <App />}
  </StrictMode>
)
