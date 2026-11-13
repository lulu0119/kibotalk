import { useId } from 'react'
import type { AppLanguage } from '@kibotalk/conversation'
import { languageLabel, systemTranscriptionOption, transcriptionModels, useI18n } from '@kibotalk/app-shared'
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kibotalk/ui'

export function TranscriptionModelPicker({ language, systemLanguages = [], value, onChange, disabled }: {
  language: AppLanguage
  systemLanguages?: readonly AppLanguage[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const id = useId()
  const { t, language: uiLanguage } = useI18n()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t('transcriptionModel')}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {systemLanguages.length > 0 && (
            <SelectItem value={systemTranscriptionOption.id} disabled={!systemLanguages.includes(language)}>
              {t('systemTranscription')} · {systemLanguages.map((option) => languageLabel(option, uiLanguage)).join(' / ')}
            </SelectItem>
          )}
          {transcriptionModels.map((model) => {
            const languages = model.languages.map((option) => languageLabel(option, uiLanguage)).join(' / ')
            const sizeMb = Math.round(model.files[0].bytes / 1_000_000)
            return (
              <SelectItem key={model.id} value={model.id} disabled={!model.languages.includes(language)}>
                {`${model.name} · ${languages} · ${sizeMb} MB`}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
