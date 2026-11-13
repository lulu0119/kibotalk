/** Captures 16 kHz mono PCM in 512-sample frames without playing it back. */
const WORKLET_SOURCE = `
class VadProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(512)
    this.pointer = 0
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0]
    if (!input) return true
    let i = 0
    while (i < input.length) {
      const remaining = this.buffer.length - this.pointer
      const take = Math.min(remaining, input.length - i)
      this.buffer.set(input.subarray(i, i + take), this.pointer)
      this.pointer += take
      i += take
      if (this.pointer >= this.buffer.length) {
        this.port.postMessage({ buffer: this.buffer.slice() })
        this.pointer = 0
      }
    }
    return true
  }
}
registerProcessor('vad-processor', VadProcessor)
`

export type AudioSourceOptions = {
  deviceId?: string
  stream?: MediaStream
  echoCancellation?: boolean
  onDeviceEnded?: () => void
}

export class AudioSource {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private stopping = false

  constructor(private options: AudioSourceOptions = {}) {}

  async start(onChunk: (pcm: Float32Array) => void, signal?: AbortSignal): Promise<void> {
    this.stopping = false
    this.stream =
      this.options.stream ??
      (await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: this.options.echoCancellation ?? true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(this.options.deviceId && this.options.deviceId !== 'default'
            ? { deviceId: { exact: this.options.deviceId } }
            : {}),
        },
      }))
    if (signal?.aborted) {
      this.stop()
      signal.throwIfAborted()
    }
    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener(
        'ended',
        () => {
          if (!this.stopping) this.options.onDeviceEnded?.()
        },
        { once: true },
      )
    }

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      await this.audioContext.audioWorklet.addModule(url)
      signal?.throwIfAborted()
    } finally {
      URL.revokeObjectURL(url)
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    this.workletNode = new AudioWorkletNode(this.audioContext, 'vad-processor', {
      channelCount: 1,
      channelCountMode: 'explicit',
    })
    this.workletNode.port.onmessage = (e: MessageEvent<{ buffer: Float32Array }>) => {
      onChunk(e.data.buffer)
    }
    this.sourceNode.connect(this.workletNode)
    // Connecting the silent output keeps the worklet in the active audio graph.
    this.workletNode.connect(this.audioContext.destination)
    await this.audioContext.resume()
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? 16000
  }

  stop(): void {
    this.stopping = true
    this.workletNode?.disconnect()
    this.sourceNode?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.audioContext?.close().catch(() => {})
    this.workletNode = null
    this.sourceNode = null
    this.stream = null
    this.audioContext = null
  }
}
