import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

type SubtitleCue = {
  startMs: number
  endMs: number
  translationText: string
}

type BenchmarkManifest = {
  media: string
  subtitles: string
  clipStartMs: number
  clipDurationMs: number
  audio: string
  transcriptGroundTruth: false
  note: string
  audioPreparation: string
  cues: SubtitleCue[]
}

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : fallback
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function parseClock(value: string): number {
  const parts = value.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid timestamp: ${value}`)
  }
  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : [0, parts[0], parts[1]]
  return ((hours * 60 + minutes) * 60 + seconds) * 1000
}

function cleanAssText(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[Nn]/g, ' ')
    .replace(/\\h/g, ' ')
    .trim()
}

function parseAss(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.startsWith('Dialogue:')) continue
    const fields = line.slice('Dialogue:'.length).split(',')
    if (fields.length < 10) continue
    const [layer, start, end, style] = fields
    if (layer.trim() !== '0' || style.trim() !== 'Default') continue
    const translationText = cleanAssText(fields.slice(9).join(','))
    if (!translationText) continue
    cues.push({
      startMs: parseClock(start.trim()),
      endMs: parseClock(end.trim()),
      translationText,
    })
  }
  return cues
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${basename(command)} exited with ${code}`))
    })
  })
}

async function prepare() {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary')
  const media = resolve(argument('--media'))
  const subtitles = resolve(argument('--subtitles'))
  const output = resolve(argument('--output', '.benchmarks/drama'))
  const clipStartMs = parseClock(argument('--start', '00:00:50'))
  const clipDurationMs = parseClock(argument('--duration', '00:03:00'))
  const audio = resolve(output, 'audio-16k-mono.wav')
  await mkdir(output, { recursive: true })

  await run(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-y',
    '-ss',
    String(clipStartMs / 1000),
    '-t',
    String(clipDurationMs / 1000),
    '-i',
    media,
    '-map',
    '0:a:0',
    '-af',
    'pan=mono|c0=FC,loudnorm=I=-23:LRA=7:TP=-2',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    audio,
  ])

  const allCues = parseAss(await readFile(subtitles, 'utf8'))
  const clipEndMs = clipStartMs + clipDurationMs
  const cues = allCues
    .filter((cue) => cue.endMs > clipStartMs && cue.startMs < clipEndMs)
    .map((cue) => ({
      startMs: Math.max(0, cue.startMs - clipStartMs),
      endMs: Math.min(clipDurationMs, cue.endMs - clipStartMs),
      translationText: cue.translationText,
    }))
  const manifest: BenchmarkManifest = {
    media,
    subtitles,
    clipStartMs,
    clipDurationMs,
    audio,
    transcriptGroundTruth: false,
    note:
      'The ASS file is a Chinese translation without speaker labels. Use cue times for approximate VAD scoring and text for scene semantics, not Japanese ASR WER.',
    audioPreparation:
      'Extracted the 5.1 center channel, which carries dialogue, then normalized it to -23 LUFS before resampling to 16 kHz mono PCM16.',
    cues,
  }
  await writeFile(
    resolve(output, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  console.log(`Prepared ${cues.length} subtitle cues in ${output}`)
}

if (process.argv[2] !== 'prepare') {
  throw new Error('Usage: drama-benchmark prepare --media ... --subtitles ... --output ...')
}
await prepare()
