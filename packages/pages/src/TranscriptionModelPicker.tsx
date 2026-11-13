import { useId } from 'react'
import type { AppLanguage } from '@kibotalk/conversation'
import { languageLabel, transcriptionModels, useI18n } from '@kibotalk/app-shared'
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kibotalk/ui'

export function TranscriptionModelPicker({ language, value, onChange, disabled }: {
  language: AppLanguage
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
