import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, ipcMain, safeStorage, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import {
  emptyLlmSettings,
  readLlmSettings,
  streamReplyText,
  type ChatMessage,
  type LlmSettings,
  type ReplyStreamMessage,
} from '@kibotalk/llm'
import { IPC_CHANNEL } from '../shared/ipc'

function settingsPath() {
  return join(app.getPath('userData'), 'reply-model.json')
}

function loadSettings(): LlmSettings {
  try {
    const stored = JSON.parse(readFileSync(settingsPath(), 'utf8')) as { settings: unknown; key?: string }
    const settings = readLlmSettings(stored.settings)
    return {
      ...settings,
      apiKey: stored.key ? safeStorage.decryptString(Buffer.from(stored.key, 'base64')) : '',
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return emptyLlmSettings
    throw cause
  }
}

function saveSettings(value: LlmSettings): void {
  const { apiKey, ...settings } = readLlmSettings(value)
  if (apiKey && !safeStorage.isEncryptionAvailable()) throw new Error('LLM_KEY_STORAGE_UNAVAILABLE')
  const key = apiKey ? safeStorage.encryptString(apiKey).toString('base64') : undefined
  const path = settingsPath()
  writeFileSync(`${path}.tmp`, JSON.stringify({ settings, key }), { mode: 0o600 })
  renameSync(`${path}.tmp`, path)
}

function isMainFrame(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return !!event.senderFrame && event.senderFrame === event.sender.mainFrame
}

function requireMainFrame(event: IpcMainInvokeEvent): void {
  if (!isMainFrame(event)) throw new Error('Reply model settings require the main app frame')
}

export function registerReplyModelHandlers(): void {
  ipcMain.handle(IPC_CHANNEL.replyModelLoad, (event) => {
    requireMainFrame(event)
    return loadSettings()
  })
  ipcMain.handle(IPC_CHANNEL.replyModelSave, (event, settings: LlmSettings) => {
    requireMainFrame(event)
    saveSettings(settings)
  })
  ipcMain.on(IPC_CHANNEL.replyModelStream, (event, input: ChatMessage[]) => {
    const [port] = event.ports
    if (!port) return
    if (!isMainFrame(event)) {
      port.close()
      return
    }
    const controller = new AbortController()
    port.on('close', () => controller.abort())
    port.start()
    const send = (message: ReplyStreamMessage) => port.postMessage(message)
    void (async () => {
      try {
        for await (const text of streamReplyText(loadSettings(), input, controller.signal)) {
          if (controller.signal.aborted) return
          send({ type: 'token', text })
        }
        send({ type: 'done' })
      } catch (cause) {
        if (!controller.signal.aborted) {
          send({ type: 'error', message: cause instanceof Error ? cause.message : String(cause) })
        }
      } finally {
        port.close()
      }
    })()
  })
}
