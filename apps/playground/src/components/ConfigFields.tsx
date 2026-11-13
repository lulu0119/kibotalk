import { useId } from 'react'
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@kibotalk/ui'
import type { AppLanguage, LearnerLevel } from '@kibotalk/conversation'
import {
  APP_LANGUAGE_OPTIONS,
  LEARNER_LEVEL_OPTIONS,
  useConfig,
} from '../config-store'

/** Shared numeric field. Reads/writes nothing itself — fully controlled. */
export function NumberField({
  label,
  value,
  step,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  value: number
  step: number
  min?: number
  max?: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(v)
        }}
        className="h-8"
      />
    </div>
  )
}

/** 0–1 threshold with Slider + numeric readout. */
export function ThresholdSlider({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  const readout = value.toFixed(2)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Label className="cursor-help text-xs text-muted-foreground">{label}</Label>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {hint}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Label className="text-xs text-muted-foreground">{label}</Label>
        )}
        <span className="text-xs tabular-nums text-foreground">{readout}</span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={0}
        max={1}
        step={0.01}
        disabled={disabled}
        onValueChange={([v]) => {
          if (typeof v === 'number' && Number.isFinite(v)) onChange(v)
        }}
      />
    </div>
  )
}

/** VAD cut stage: thresholds, silence, min speech. */
export function VadParamsFields({ disabled }: { disabled?: boolean } = {}) {
  const speechThreshold = useConfig((s) => s.speechThreshold)
  const minSilenceDurationMs = useConfig((s) => s.minSilenceDurationMs)
  const minSpeechDurationMs = useConfig((s) => s.minSpeechDurationMs)
  const patch = useConfig((s) => s.patch)
  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <ThresholdSlider
        label="进入阈值"
        hint="语音概率超过此值视为开始说话（默认 0.2）"
        value={speechThreshold}
        onChange={(v) => patch({ speechThreshold: v })}
      />
      <NumberField label="静音结束 ms（400）" value={minSilenceDurationMs} step={50} min={0}
        onChange={(v) => patch({ minSilenceDurationMs: v })} />
      <NumberField label="最短语音 ms（200）" value={minSpeechDurationMs} step={50} min={0}
        onChange={(v) => patch({ minSpeechDurationMs: v })} />
    </fieldset>
  )
}

/** Merge / scheduling: single pause + max speech length (TurnGate). */
export function MergeParamsFields({ disabled }: { disabled?: boolean }) {
  const pauseMs = useConfig((s) => s.pauseMs)
  const mergeMaxMs = useConfig((s) => s.mergeMaxMs)
  const patch = useConfig((s) => s.patch)
  return (
    <>
      <NumberField label="暂停 ms（500）·成句" value={pauseMs} step={100} min={0} disabled={disabled}
        onChange={(v) => patch({ pauseMs: v })} />
      <NumberField label="合并上限 ms（30000）·语音" value={mergeMaxMs} step={1000} min={0} disabled={disabled}
        onChange={(v) => patch({ mergeMaxMs: v })} />
    </>
  )
}

export function LanguagePrefsFields({ disabled }: { disabled?: boolean }) {
  const id = useId()
  const conversationLang = useConfig((s) => s.conversationLang)
  const uiLang = useConfig((s) => s.uiLang)
  const level = useConfig((s) => s.level)
  const setConversationLang = useConfig((s) => s.setConversationLang)
  const setUiLang = useConfig((s) => s.setUiLang)
  const setCurrentLevel = useConfig((s) => s.setCurrentLevel)
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-conversation`}>对话语言</Label>
        <Select
          value={conversationLang}
          onValueChange={(v) => setConversationLang(v as AppLanguage)}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-conversation`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APP_LANGUAGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-meaning`}>候选释义语言</Label>
        <Select
          value={uiLang}
          onValueChange={(v) => setUiLang(v as AppLanguage)}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-meaning`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APP_LANGUAGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-level`}>当前水平</Label>
        <Select
          value={level}
          onValueChange={(v) => setCurrentLevel(v as LearnerLevel)}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-level`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEARNER_LEVEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
