import { beginSpan, SeriesWriter, type TraceSpan } from '@proj-airi/trace-kit'
import { VoiceNames, VoiceSeries } from '@proj-airi/trace-kit/voice'
import { filePlaybackActor as actor, filePlaybackTrack as playbackTrack, traceSource } from './io-tracer/trace'

export function createFileAudio(element: HTMLMediaElement) {
  const context = new AudioContext()
  const source = context.createMediaElementSource(element)
  const input = context.createMediaStreamDestination()
  const output = context.createGain()
  source.connect(input)
  source.connect(output).connect(context.destination)
  return {
    stream: () => input.stream.clone(),
    resume: () => context.resume(),
    volume: (value: number) => { output.gain.value = value },
    dispose() {
      input.stream.getTracks().forEach((track) => track.stop())
      void context.close()
    },
  }
}

type PlaybackRange = { start: number; offset: number; rate: number; end?: number }

export function createPlaybackTrace() {
  const ranges: PlaybackRange[] = []
  const level = new SeriesWriter(() => traceSource, { track: playbackTrack, ids: { actor }, chunkMs: 250 })
  let range: PlaybackRange | undefined
  let span: TraceSpan | undefined

  function pause() {
    if (!range) return
    range.end = traceSource.now()
    level.flush()
    span?.end({ ts: range.end })
    range = undefined
  }

  return {
    play(media: HTMLMediaElement) {
      pause()
      range = { start: traceSource.now(), offset: media.currentTime, rate: media.playbackRate }
      ranges.push(range)
      span = beginSpan(traceSource, {
        track: playbackTrack, name: VoiceNames.Playback, ts: range.start, ids: { actor },
      })
    },
    pause,
    clear() {
      pause()
      ranges.length = 0
    },
    frame(pcm: Float32Array) {
      if (!range || !level.wanted()) return
      const rms = Math.sqrt(pcm.reduce((sum, sample) => sum + sample * sample, 0) / pcm.length)
      level.push({ [VoiceSeries.Level]: Math.max(0, Math.min(1, 1 + Math.log10(rms) / 3)) })
    },
    cursor(position: number) {
      for (let index = ranges.length - 1; index >= 0; index--) {
        const item = ranges[index]
        const time = item.start + (position - item.offset) * 1000 / item.rate
        if (time >= item.start && time <= (item.end ?? traceSource.now()) + 25) return time
      }
    },
    position(time: number) {
      const match = ranges.find((item) => time >= item.start && time <= (item.end ?? traceSource.now()))
      return match && match.offset + (time - match.start) / 1000 * match.rate
    },
  }
}
