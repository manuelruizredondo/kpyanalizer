import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import './index.css'
import App from './App'

// Tras un despliegue, las pestañas abiertas piden chunks con hash antiguo que
// ya no existen. Se recarga una vez para coger la versión nueva (el flag evita
// un bucle de recargas si el fallo fuera otro).
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('kpy_chunk_reload')) return
    sessionStorage.setItem('kpy_chunk_reload', '1')
  } catch { /* sin sessionStorage: recargar igualmente */ }
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  try { sessionStorage.removeItem('kpy_chunk_reload') } catch { /* ignore */ }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
