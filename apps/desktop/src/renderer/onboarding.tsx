import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@kibotalk/app-shared'
import { OnboardingDownloadIndicator, type OnboardingDownloadProgress } from '@kibotalk/pages'
import { Toaster, TooltipProvider } from '@kibotalk/ui'
import OnboardingApp from './OnboardingApp'
import './onboarding.css'

function DownloadWindow() {
  const [progress, setProgress] = useState<OnboardingDownloadProgress>(null)
  useEffect(() => {
    const unsubscribe = window.kibotalk.onboarding.onDownloadProgress(setProgress)
    window.kibotalk.onboarding.downloadReady()
    return unsubscribe
  }, [])
  return (
    <I18nProvider>
      {progress && <OnboardingDownloadIndicator {...progress} />}
    </I18nProvider>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')
const downloadWindow = window.location.hash === '#download-progress'
if (downloadWindow) document.documentElement.dataset.downloadWindow = ''
createRoot(root).render(
  <StrictMode>
    {downloadWindow ? <DownloadWindow /> : (
      <TooltipProvider delayDuration={280}>
        <OnboardingApp />
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    )}
  </StrictMode>,
)
