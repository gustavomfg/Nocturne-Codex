import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

window.addEventListener('error', (event) => { void window.nocturne.diagnostics.rendererError({ type: 'error', message: event.message, stack: event.error instanceof Error ? event.error.stack : undefined }) })
window.addEventListener('unhandledrejection', (event) => { const error = event.reason; void window.nocturne.diagnostics.rendererError({ type: 'unhandledRejection', message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }) })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
