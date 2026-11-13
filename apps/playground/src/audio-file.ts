export function concatPcm(chunks: readonly Float32Array[]): Float32Array {
  const samples = new Float32Array(chunks.reduce((length, chunk) => length + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    samples.set(chunk, offset)
    offset += chunk.length
  }
  return samples
}

export async function decodeMonoAudio(file: File) {
  try {
    const sampleRate = 16000
    const audio = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(await file.arrayBuffer())
    const samples = new Float32Array(audio.length)
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const pcm = audio.getChannelData(channel)
      for (let index = 0; index < samples.length; index++) samples[index] += pcm[index] / audio.numberOfChannels
    }
    return { samples, sampleRate, duration: audio.duration }
  } catch {
    throw new Error('无法读取这个文件的音轨。请试试 WAV、MP3 或带 AAC 音轨的 MP4。')
  }
}
