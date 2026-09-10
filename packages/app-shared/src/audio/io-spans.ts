import type { VAD } from '@kibotalk/audio/vad'
import {
  recordSegmentAggregateSpan,
  recordVoiceActivitySpan,
} from '@kibotalk/observability'

type AggregatedFlush = {
  startedAt: number
  endedAt: number
  pcm: { length: number }
  segments: unknown[]
}

/** Subscribe VAD / aggregator events to IO spans. Safe when tracing is off. */
export function attachAudioIoSpans<T extends AggregatedFlush>(
  vad: VAD,
  aggregator: { onFlush(handler: (seg: T) => void): () => void },
  sampleRate: number,
): () => void {
  const offVad = vad.on('speech-ready', (ready) => {
    recordVoiceActivitySpan({
      startedAt: ready.startedAt,
      durationSec: ready.duration,
      speechSamples: ready.speechSamples,
    })
  })
  const offAggregator = aggregator.onFlush((seg) => {
    recordSegmentAggregateSpan({
      startedAt: seg.startedAt,
      endedAt: seg.endedAt,
      segmentCount: seg.segments.length,
      totalMs: (seg.pcm.length / sampleRate) * 1000,
    })
  })
  return () => {
    offVad()
    offAggregator()
  }
}
