import type { ReactNode } from 'react'
import { useI18n } from '@kibotalk/app-shared'
import { Button, cn } from '@kibotalk/ui'
import { ArrowLeftIcon } from '@kibotalk/ui/icons'

export function OnboardingSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const { t } = useI18n()
  const labels = ['setupConversation', 'chooseProvider', 'setupReplyModel', 'voiceprint'] as const
  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {labels.map((label, index) => (
        <li
          key={label}
          aria-current={index === step - 1 ? 'step' : undefined}
          className={cn('h-1 rounded-full', index < step ? 'bg-primary' : 'bg-muted')}
        >
          <span className="sr-only">{t(label)}</span>
        </li>
      ))}
    </ol>
  )
}

export function OnboardingActions({ children, onBack, disabled }: {
  children: ReactNode
  onBack?: () => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="mt-auto flex items-center gap-2 border-t border-border pt-4">
      {onBack && (
        <Button type="button" variant="ghost" onClick={onBack} disabled={disabled}>
          <ArrowLeftIcon />{t('previousStep')}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  )
}
