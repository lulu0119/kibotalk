import { useEffect, useRef, useState } from 'react'
import { AudioSource } from '@kibotalk/app-shared'
import { encodeWav } from '@kibotalk/audio'
import { concatPcm } from './audio-file'

export function useMicrophoneRecording(onRecorded: (file: File) => void, onError: (message: string) => void) {
  const [state, setState] = useState<'requesting' | 'recording'>()
  const active = useRef<{ audio: AudioSource; controller: AbortController; chunks: Float32Array[] }>(null)

  useEffect(() => () => {
    active.current?.controller.abort()
    active.current?.audio.stop()
    active.current = null
  }, [])

  function stop() {
    const recording = active.current
    if (!recording) return
    active.current = null
    recording.controller.abort()
    recording.audio.stop()
    setState(undefined)
    const samples = concatPcm(recording.chunks)
    if (!samples.length) {
      onError('没有录到音频，请重试。')
      return
    }
    onRecorded(new File([encodeWav(samples, recording.audio.sampleRate)], '麦克风录音.wav', { type: 'audio/wav' }))
  }

  async function start() {
    if (active.current) return
    const controller = new AbortController()
    const audio = new AudioSource({ onDeviceEnded: stop })
    const chunks: Float32Array[] = []
    active.current = { audio, controller, chunks }
    setState('requesting')
    try {
      await audio.start((chunk) => chunks.push(chunk), controller.signal)
      if (!controller.signal.aborted) setState('recording')
    } catch {
      audio.stop()
      if (controller.signal.aborted) return
      active.current = null
      setState(undefined)
      onError('无法开始录音，请检查麦克风权限。')
    }
  }

  return { state, start, stop }
}
