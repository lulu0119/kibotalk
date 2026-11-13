import {
  IslandBar as SharedIslandBar,
  IslandDragHandle,
  IslandSeparator,
  IslandStatus,
  IslandToggleButton,
} from '@kibotalk/ui'
import { MicrophoneDuotoneIcon, MicrophoneOffDuotoneIcon, SparklesDuotoneIcon } from '@kibotalk/ui/icons'

export type IslandBarProps = {
  state: string
  vadStatus: 'idle' | 'speech' | 'silence'
  sttEnabled: boolean
  replyEnabled: boolean
  onToggleStt: () => void
  onToggleReply: () => void
}

function statusTone(state: string, vadStatus: IslandBarProps['vadStatus'], sttEnabled: boolean) {
  if (state === 'LLM_STREAMING') {
    return { label: '生成中', pulse: true, toneClassName: 'bg-white/70' }
  }
  if (!sttEnabled) return { label: '转写暂停' }
  if (vadStatus === 'speech' || state === 'USER_SPEAKING' || state === 'OTHER_SPEAKING') {
    return { label: '听写中', pulse: true, toneClassName: 'bg-primary-soft-strong' }
  }
  if (state !== 'IDLE') {
    return { label: state, toneClassName: 'bg-white/50' }
  }
  return { label: '空闲' }
}

export function IslandBar({
  state,
  vadStatus,
  sttEnabled,
  replyEnabled,
  onToggleStt,
  onToggleReply,
}: IslandBarProps) {
  const tone = statusTone(state, vadStatus, sttEnabled)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <SharedIslandBar className="pointer-events-auto">
        <IslandStatus {...tone} />
        <IslandSeparator />
        <IslandToggleButton on={sttEnabled} label={sttEnabled ? '转写：开' : '转写：关'} onClick={onToggleStt}>
          {sttEnabled ? <MicrophoneDuotoneIcon /> : <MicrophoneOffDuotoneIcon />}
        </IslandToggleButton>
        <IslandToggleButton on={replyEnabled} label={replyEnabled ? 'AI 提示：开' : 'AI 提示：关'} onClick={onToggleReply}>
          <SparklesDuotoneIcon />
        </IslandToggleButton>
        <IslandSeparator />
        <IslandDragHandle />
      </SharedIslandBar>
    </div>
  )
}
