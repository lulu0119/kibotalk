import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseSpeechModelFiles } from '@kibotalk/app-shared/local-models'

const directory = fileURLToPath(new URL('../resources/bundle-models/', import.meta.url))
await mkdir(directory, { recursive: true })

await Promise.all(baseSpeechModelFiles.map(async (file) => {
  const destination = join(directory, file.bundledName)
  const existing = await stat(destination).catch(() => undefined)
  if (existing?.isFile() && existing.size === file.bytes) return

  const response = await fetch(file.url)
  if (!response.ok) throw new Error(`${file.bundledName}: HTTP ${response.status}`)
  const data = new Uint8Array(await response.arrayBuffer())
  if (data.byteLength !== file.bytes) throw new Error(`${file.bundledName}: incomplete download`)

  const temporary = `${destination}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, data)
    await rename(temporary, destination)
  } finally {
    await rm(temporary, { force: true })
  }
  console.log(`Staged ${file.bundledName}`)
}))
