import type { ReactNode } from 'react'
import { useI18n } from '@kibotalk/app-shared'
import { DesktopProductWindowFrame, cn } from '@kibotalk/ui'
import { brandWordmark, LanguageMarquee } from '@kibotalk/ui/marketing'
import './onboarding-screen.css'

export function OnboardingScreen({ children, embedded }: {
  children: ReactNode
  embedded?: boolean
}) {
  const { t } = useI18n()
  const content = (
    <main className={cn(
      'mx-auto grid w-full max-w-224 overflow-hidden bg-card md:grid-cols-2',
      !embedded && 'rounded-2xl border border-border shadow-sm',
    )}>
      <div className="relative isolate grid min-h-28 place-items-center overflow-hidden border-b border-border bg-primary/12 md:min-h-0 md:border-r md:border-b-0 dark:bg-primary/10">
        <LanguageMarquee
          pauseLabel={t('pauseAnimation')}
          resumeLabel={t('resumeAnimation')}
          className="onboarding-marquee absolute inset-0 grid items-center"
          controlsClassName="absolute right-3 bottom-3 z-10"
        />
        <div className="onboarding-wordmark pointer-events-none relative grid size-full place-items-center">
          <img src={brandWordmark} alt="KiboTalk" width={495} height={145} className="h-auto w-40 max-w-5/6 drop-shadow-sm md:w-60" />
        </div>
      </div>
      <div className="flex min-h-104 min-w-0 flex-col gap-4 px-5 py-5 sm:px-6 md:min-h-124 md:p-7">
        {children}
      </div>
    </main>
  )
  if (embedded) {
    return <DesktopProductWindowFrame heightMode="content">{content}</DesktopProductWindowFrame>
  }
  return <div className="flex min-h-dvh items-center justify-center px-4 pt-16 pb-6 md:py-12">{content}</div>
}
