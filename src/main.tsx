import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StyleSample } from './sample/StyleSample'
import './styles.css'

const isSample = new URLSearchParams(window.location.search).has('sample')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isSample ? <StyleSample /> : <App />}</StrictMode>,
)
