import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Detectar nuevas versiones via Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Guardar flag para que React lo muestre
    window.__CASHIPOP_UPDATE = true
    window.dispatchEvent(new Event('cashipop-update'))
  },
  onOfflineReady() {
    console.log('Cashipop lista para uso sin conexión')
  },
})

// Exponer la función de actualización globalmente
window.__CASHIPOP_DO_UPDATE = () => {
  updateSW(true) // Acepta el nuevo SW
  setTimeout(() => window.location.reload(), 300)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
