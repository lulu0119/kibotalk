import { IOAttributes, IOSpanNames, IOSubsystems } from './io-trace'
import { startSpan } from './io-tracer'

export function recordVoiceActivitySpan(args: {
  startedAt: number
  durationSec: number
  speechSamples: number
}): void {
  const span = startSpan(IOSpanNames.VoiceActivity, {
    startTime: args.startedAt,
    attrs: {
      [IOAttributes.Subsystem]: IOSubsystems.VAD,
      [IOAttributes.VadDuration]: args.durationSec,
      [IOAttributes.VadSpeechSamples]: args.speechSamples,
    },
  })
  span.end()
}

export function recordSegmentAggregateSpan(args: {
  startedAt: number
  endedAt: number
  segmentCount: number
  totalMs: number
}): void {
  const span = startSpan(IOSpanNames.SegmentAggregate, {
    startTime: args.startedAt,
    attrs: {
      [IOAttributes.Subsystem]: IOSubsystems.Aggregator,
      [IOAttributes.AggregatorSegments]: args.segmentCount,
      [IOAttributes.AggregatorTotalMs]: args.totalMs,
    },
  })
  span.end(args.endedAt)
}
