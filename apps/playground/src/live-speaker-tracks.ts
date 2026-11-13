import type { SessionAudioSource } from '@kibotalk/conversation'
import type { StreamingDiarizer } from '@sherpaw/speaker-diarization/conversation'

export type SpeakerInput = Exclude<SessionAudioSource, 'both'>

export type LiveSpeakerSegment = {
  id: number
  start: number
  end: number
  speaker: number | null
  live?: boolean
  overlap?: boolean
}

export type LiveSpeakerLane = {
  input: SpeakerInput
  status: 'loading' | 'ready' | 'ended' | 'error'
  time: number
  segments: LiveSpeakerSegment[]
}

const sampleRate = 16_000
const blockSize = 4096
const maxPendingSamples = sampleRate * 30
export const speakerWindowSeconds = 30

export function trackLiveSpeakers(source: SessionAudioSource, onUpdate: (lanes: LiveSpeakerLane[]) => void) {
  const inputs: SpeakerInput[] = source === 'both' ? ['microphone', 'system'] : [source]
  let origin: number | undefined
  const snapshots = new Map<SpeakerInput, LiveSpeakerLane>()
  const lanes = new Map(inputs.map((input) => [input, trackInput(input, (view) => {
    snapshots.set(input, view)
    onUpdate(inputs.flatMap((key) => snapshots.get(key) ?? []))
  })]))

  return {
    accept(input: SpeakerInput, frame: Float32Array) {
      origin ??= performance.now()
      lanes.get(input)?.accept(frame, (performance.now() - origin) / 1000)
    },
    finish() {
      for (const lane of lanes.values()) lane.finish()
    },
    dispose() {
      for (const lane of lanes.values()) lane.dispose()
    },
  }
}

function trackInput(input: SpeakerInput, publish: (view: LiveSpeakerLane) => void) {
  const controller = new AbortController()
  const { signal } = controller
  const pending: Float32Array[] = []
  const turns = new Map<number, LiveSpeakerSegment>()
  let pendingSamples = 0
  let time = 0
  let offset = 0
  let started = false
  let processing = false
  let ending = false
  let diarizer: StreamingDiarizer | undefined
  let partial: LiveSpeakerSegment | undefined

  function update(status: LiveSpeakerLane['status']) {
    const cutoff = time - speakerWindowSeconds
    for (const [id, segment] of turns) {
      if (segment.end <= cutoff) turns.delete(id)
    }
    const segments = [...turns.values()]
    if (partial && partial.end > cutoff) segments.push(partial)
    publish({ input, status, time, segments })
  }

  function dispose() {
    controller.abort()
    pending.length = 0
    pendingSamples = 0
  }

  function fail() {
    if (signal.aborted) return
    partial = undefined
    update('error')
    dispose()
  }

  async function pump() {
    if (!diarizer || processing || signal.aborted) return
    processing = true
    try {
      while (pendingSamples >= blockSize || (ending && pendingSamples > 0)) {
        const block = new Float32Array(Math.min(pendingSamples, blockSize))
        let written = 0
        while (written < block.length) {
          const chunk = pending.shift()!
          const take = Math.min(chunk.length, block.length - written)
          block.set(chunk.subarray(0, take), written)
          if (take < chunk.length) pending.unshift(chunk.subarray(take))
          written += take
        }
        pendingSamples -= block.length
        await diarizer.push(block)
        if (signal.aborted) return
        time += block.length / sampleRate
        update('ready')
      }
      if (ending) {
        await diarizer.flush()
        if (signal.aborted) return
        partial = undefined
        update('ended')
        dispose()
      }
    } catch {
      fail()
    } finally {
      processing = false
    }
  }

  update('loading')
  void import('./speaker-diarization').then(async ({ createLiveSpeakerDiarizer }) => {
    signal.throwIfAborted()
    diarizer = await createLiveSpeakerDiarizer(signal)
    if (signal.aborted) return
    diarizer.on('speech-start', ({ time }) => {
      partial = { id: -1, start: time + offset, end: time + offset, speaker: null, live: true }
    })
    diarizer.on('partial', ({ partial: guess }) => {
      const start = guess.start + offset
      partial = { id: -1, start, end: Math.max(start, partial?.end ?? start), speaker: guess.guess?.speaker ?? null, live: true }
    })
    diarizer.on('audio', ({ time, samples }) => {
      if (partial) partial = { ...partial, end: time + offset + samples.length / sampleRate }
    })
    diarizer.on('turn-update', ({ turn, changed }) => {
      if (changed.includes('created')) partial = undefined
      const end = turn.end + offset
      if (end <= time - speakerWindowSeconds) return
      turns.set(turn.index, {
        id: turn.index,
        start: turn.start + offset,
        end,
        speaker: turn.speaker,
        overlap: turn.label?.overlap,
      })
    })
    diarizer.on('speech-end', () => { partial = undefined })
    diarizer.on('error', fail)
    time = offset
    update('ready')
    await pump()
  }).catch(fail)

  return {
    accept(frame: Float32Array, startTime: number) {
      if (ending || signal.aborted) return
      if (!started) {
        offset = startTime
        time = offset
        started = true
      }
      pending.push(frame.slice())
      pendingSamples += frame.length
      if (diarizer && pendingSamples > maxPendingSamples) {
        fail()
        return
      }
      while (pendingSamples > maxPendingSamples) {
        const dropped = pending.shift()!.length
        pendingSamples -= dropped
        offset += dropped / sampleRate
      }
      if (pendingSamples >= blockSize) void pump()
    },
    finish() {
      if (ending || signal.aborted) return
      ending = true
      if (!started) {
        update('ended')
        dispose()
      } else {
        void pump()
      }
    },
    dispose,
  }
}
