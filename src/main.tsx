import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthGate } from './components/AuthGate'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Application root not found')

createRoot(root).render(<StrictMode><ErrorBoundary><AuthGate><App/></AuthGate></ErrorBoundary></StrictMode>)
