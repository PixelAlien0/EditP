import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme-tokens.css'
import './index.css'
import './styles/features/dark-mode.css'
import './styles/features/batch-adjust.css'
import './styles/features/clone-creator.css'
import './styles/features/build-menu.css'
import './styles/features/editor-parameters.css'
import './styles/features/credits.css'
import './styles/features/header.css'
import './styles/features/temporary-chat.css'
import './styles/features/project-changes.css'
import './styles/features/sidebar.css'
import './styles/features/main-menu.css'
import './styles/features/accessibility.css'
import './styles/features/preset-gallery.css'
import './styles/features/editor-context.css'
import './components/ui/ui.css'
import './styles/features/summary-explorer.css'
import './styles/features/online-presence.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
