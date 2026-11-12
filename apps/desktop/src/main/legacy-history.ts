import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'

/** The last account ID locates the existing local IndexedDB history. */
export function previousHistoryUserId(): string | null {
  try {
    const path = join(app.getPath('userData'), 'account-cache.bin')
    if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null
    const raw = safeStorage.decryptString(readFileSync(path))
    const cached = JSON.parse(raw) as { user?: { id?: unknown } }
    return typeof cached?.user?.id === 'string' ? cached.user.id : null
  } catch {
    return null
  }
}
