import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster, TooltipProvider } from '@kibotalk/ui'
import OnboardingApp from './OnboardingApp'
import './onboarding.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')
createRoot(root).render(
  <StrictMode>
    <TooltipProvider delayDuration={280}>
      <OnboardingApp />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  </StrictMode>,
)
