import { useEffect, useRef, useState } from 'react'
import { AudioSource, createSpeechEngine, type SpeechEngine } from '@kibotalk/app-shared'
import { createSegmentAggregator, type AggregatedSegment } from '@kibotalk/audio/aggregator'
import { encodeWav } from '@kibotalk/audio'
import { Button, Card, CardContent } from '@kibotalk/ui'
import { MergeParamsFields, VadParamsFields } from './components/ConfigFields'
import { useConfig } from './config-store'

export default function VadPanel() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'speech' | 'silence'>('idle')
  const [error, setError] = useState('')
  const [segments, setSegments] = useState<AggregatedSegment[]>([])
  const capture = useRef<{
    controller: AbortController
    audio: AudioSource
    engine?: SpeechEngine
    aggregator: ReturnType<typeof createSegmentAggregator>
  } | null>(null)
  const playing = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)

  function stop() {
    const current = capture.current
    capture.current = null
    if (!current) return
    current.audio.stop()
    current.controller.abort()
    current.engine?.dispose()
    current.aggregator.flush()
    current.aggregator.dispose()
    setStatus('idle')
  }

  function stopPlayback() {
    playing.current?.audio.pause()
    if (playing.current) URL.revokeObjectURL(playing.current.url)
    playing.current = null
  }

  useEffect(() => () => {
    stop()
    stopPlayback()
  }, [])

  async function start() {
    if (capture.current) return
    setStatus('loading')
    setSegments([])
    setError('')
    const controller = new AbortController()
    const audio = new AudioSource({ onDeviceEnded: stop })
    const config = useConfig.getState()
    const aggregator = createSegmentAggregator({
      sampleRate: audio.sampleRate, pauseMs: config.pauseMs, maxMs: config.mergeMaxMs,
    })
    aggregator.onFlush((segment) => setSegments((previous) => [...previous.slice(-29), segment]))
    const current = { controller, audio, aggregator, engine: undefined as SpeechEngine | undefined }
    capture.current = current
    try {
      const engine = await createSpeechEngine(undefined, {
        threshold: config.speechThreshold,
        minSpeechMs: config.minSpeechDurationMs,
        minSilenceMs: config.minSilenceDurationMs,
        maxSpeechMs: config.mergeMaxMs,
      }, 1, controller.signal)
      current.engine = engine
      controller.signal.throwIfAborted()
      let wasSpeaking = false
      await audio.start((pcm) => {
        void engine.process(0, pcm).then(({ speaking, segments }) => {
          if (controller.signal.aborted) return
          setStatus(speaking ? 'speech' : 'silence')
          if (speaking !== wasSpeaking) {
            if (speaking) aggregator.hold()
            else aggregator.resume()
            wasSpeaking = speaking
          }
          for (const segment of segments) {
            aggregator.feed({
              buffer: segment.pcm, speaker: 'other',
              startedAt: segment.startedAt, endedAt: segment.endedAt,
            })
          }
        }).catch((cause) => {
          if (controller.signal.aborted) return
          setError(String(cause))
          stop()
        })
      }, controller.signal)
      controller.signal.throwIfAborted()
      setStatus('silence')
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(String(cause))
      stop()
    }
  }

  function play(segment: AggregatedSegment) {
    stopPlayback()
    const url = URL.createObjectURL(new Blob([encodeWav(segment.pcm, 16000)], { type: 'audio/wav' }))
    const audio = new Audio(url)
    playing.current = { audio, url }
    audio.onended = stopPlayback
    void audio.play().catch(stopPlayback)
  }

  return (
    <Card>
      <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-semibold">Silero VAD v5</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {status === 'idle' ? (
              <Button onClick={() => void start()}>开始检测</Button>
            ) : (
              <Button variant="destructive" onClick={stop}>停止</Button>
            )}
            {status === 'loading' ? '正在加载模型…' : status === 'speech' ? '检测到语音' : status === 'silence' ? '静音' : null}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <VadParamsFields disabled={status !== 'idle'} />
          <MergeParamsFields disabled={status !== 'idle'} />
        </div>
        <div className="space-y-3">
          <h2 className="font-semibold">合并片段</h2>
          {segments.length ? (
            <ol className="space-y-2">
              {[...segments].reverse().map((segment) => (
                <li key={segment.startedAt} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <span>{Math.round(segment.pcm.length / 16)} ms · {segment.segments.length} 段</span>
                  <Button size="sm" variant="outline" onClick={() => play(segment)}>播放</Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">检测到的语音片段会显示在这里，可以回放。</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
