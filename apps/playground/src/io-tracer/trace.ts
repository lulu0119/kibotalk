import { REPLY_READY_MS, replyTraceProfile } from '@kibotalk/pipeline'
import { beginSpan, TraceSource, trackPath, type TraceSink } from '@proj-airi/trace-kit'
import { AgentAttributes, AgentNames, AgentTracks, agentProfile } from '@proj-airi/trace-kit/agent'
import { TraceCollector } from '@proj-airi/trace-kit/collector'
import { VoiceAttributes, VoiceNames, VoiceTracks, voiceProfile } from '@proj-airi/trace-kit/voice'

const now = () => performance.now()
let collector = new TraceCollector({ now })
let source: TraceSource | undefined

export function startTrace() {
  source ??= new TraceSource({
    source: 'kibotalk:playground',
    clock: collector.traceClock,
    runtime: 'browser',
    now,
    profiles: [voiceProfile, agentProfile, replyTraceProfile],
    send: (record) => collector.ingest(record),
  })
}

export function pauseTrace() {
  source?.stop()
  source = undefined
}

export function traceCollector() {
  return collector
}

export function resetTrace() {
  pauseTrace()
  collector = new TraceCollector({ now })
  startTrace()
}

export const traceSource: TraceSink = {
  now,
  emit: (record) => source?.emit(record),
  wants: (track) => source?.wants(track) ?? false,
}

export function exportTrace(records: TraceCollector = collector) {
  const snapshot = records.snapshot()
  const file = new Blob(snapshot.records.map((record) => JSON.stringify(record) + '\n'), { type: 'application/x-ndjson' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `kibotalk-trace-${Date.now()}.jsonl`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function traceTick() {
  if (source) collector.touch(source.source)
  collector.tick()
}

export function traceIsRecording() {
  return source !== undefined
}

/** A synthetic turn for the sample viewer. It uses its own clock and collector. */
export function createSampleTrace() {
  const now = () => 5900
  const records = new TraceCollector({ now })
  const sample = new TraceSource({
    source: 'kibotalk:example',
    clock: records.traceClock,
    runtime: 'browser',
    now,
    profiles: [voiceProfile, agentProfile, replyTraceProfile],
    send: (record) => records.ingest(record),
  })
  const ids = { actor: 'other', turn: 'sample-turn' }
  beginSpan(sample, {
    track: trackPath(VoiceTracks.Speech, { actor: 'other' }),
    name: VoiceNames.SpeechSegment,
    ts: 1100,
    attrs: { [VoiceAttributes.SpeechDurationMs]: 2390 },
    ids,
  }).end({ ts: 3490 })
  const recognition = beginSpan(sample, {
    track: trackPath(VoiceTracks.ASR, { actor: 'other' }),
    name: VoiceNames.SpeechRecognition,
    ts: 1310,
    ids,
  })
  recognition.instant(VoiceNames.TranscriptPartial, undefined, 1780)
  recognition.instant(VoiceNames.TranscriptPartial, undefined, 2590)
  recognition.end({ ts: 3820 })
  const turn = beginSpan(sample, {
    track: trackPath(AgentTracks.Turn, { agent: 'coach' }),
    name: AgentNames.ChatTurn,
    ts: 4470,
    ids,
  })
  const reply = beginSpan(sample, {
    track: trackPath(AgentTracks.LLM, { agent: 'coach' }),
    name: AgentNames.ModelRequest,
    ts: 4530,
    ids,
    parent: turn,
  })
  const metrics = { [AgentAttributes.LLMTtftMs]: 440 }
  reply.instant(AgentNames.LLMFirstChunk, metrics, 4970)
  reply.end({ ts: 5590, attrs: { ...metrics, [REPLY_READY_MS]: 2100 } })
  turn.end({ ts: 5620 })
  return records
}
