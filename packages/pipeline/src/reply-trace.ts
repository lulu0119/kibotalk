import { defineMetric, defineProfile } from '@proj-airi/trace-kit'
import { AgentTracks } from '@proj-airi/trace-kit/agent'

export const REPLY_READY_MS = 'kibotalk.reply.ready_ms'

export const replyTraceProfile = defineProfile({
  key: 'plugin:kibotalk',
  version: '1',
  label: 'KiboTalk',
  metrics: [
    defineMetric({
      key: REPLY_READY_MS,
      label: { en: 'Speech end to suggestions ready', 'zh-Hans': '说完到建议就绪' },
      unit: 'ms',
      better: 'lower',
      value: { kind: 'attribute', track: AgentTracks.LLM, record: 'span.end', attribute: REPLY_READY_MS },
    }),
  ],
})
