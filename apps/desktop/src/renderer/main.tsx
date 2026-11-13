import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@kibotalk/ui'
import IslandApp from './IslandApp'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')
createRoot(root).render(
  <StrictMode>
    <TooltipProvider delayDuration={280}>
      <IslandApp />
    </TooltipProvider>
  </StrictMode>,
)
