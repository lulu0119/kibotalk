import type { SessionDraft, SessionTurn } from '@kibotalk/app-shared'
import type { SessionAudioSource, Speaker } from '@kibotalk/conversation'
import { Badge, cn } from '@kibotalk/ui'

export function TranscriptPanel({
  turns,
  draft,
  source,
  verifiedSpeakers,
}: {
  turns: SessionTurn[]
  draft: SessionDraft | null
  source: SessionAudioSource
  verifiedSpeakers: boolean
}) {
  function speakerLabel(speaker: Speaker) {
    if (source === 'system' || (source === 'both' && speaker === 'other')) return '共享音频'
    if (!verifiedSpeakers) return '麦克风'
    return speaker === 'user' ? '我' : '对方'
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
      <ol className="space-y-3" aria-label="对话转写">
        {draft && (
          <li className="space-y-2 rounded-md border border-dashed p-3">
            <Badge variant="secondary">{speakerLabel(draft.speaker)} · 正在转写</Badge>
            <p className="text-sm wrap-break-word">{draft.text || '…'}</p>
          </li>
        )}
        {[...turns].reverse().map((turn) => (
          <li key={turn.id} className={cn('space-y-2 rounded-md border bg-muted/40 p-3', turn.sttFailed && 'border-destructive/40')}>
            <Badge variant={turn.speaker === 'user' ? 'default' : 'secondary'}>{speakerLabel(turn.speaker)}</Badge>
            <p className="text-sm wrap-break-word">{turn.sttFailed ? '转写失败' : turn.text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
