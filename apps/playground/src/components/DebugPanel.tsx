import { Button } from '@kibotalk/ui'
import { RestartIcon } from '@kibotalk/ui/icons'
import { useConfig } from '../config-store'
import { MergeParamsFields, NumberField, ThresholdSlider, VadParamsFields } from './ConfigFields'

export function DebugPanel({ running, confidence }: { running: boolean; confidence: number | null }) {
  const speakerThreshold = useConfig((s) => s.speakerThreshold)
  const candidateRoundsMax = useConfig((s) => s.candidateRoundsMax)
  const patch = useConfig((s) => s.patch)

  return (
    <div className="grid gap-4">
      <VadParamsFields disabled={running} />
      <ThresholdSlider
        label="说话人阈值"
        hint={confidence === null ? '录入声纹后生效' : `最近声纹匹配置信度 ${confidence.toFixed(2)}`}
        value={speakerThreshold}
        onChange={(value) => patch({ speakerThreshold: value })}
      />
      <MergeParamsFields />
      <NumberField
        label="显示最近几轮回复"
        value={candidateRoundsMax}
        step={1}
        min={1}
        max={6}
        onChange={(value) => patch({ candidateRoundsMax: Math.round(value) })}
      />
      <Button className="justify-self-start" variant="outline" onClick={() => useConfig.getState().reset()} disabled={running}>
        <RestartIcon />恢复默认
      </Button>
    </div>
  )
}
