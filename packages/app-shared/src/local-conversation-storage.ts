import {
  accountConversationDatabaseName,
  IndexedDbConversationStorage,
} from '@kibotalk/conversation'

function previousWebHistoryUserId(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem('kibotalk-account-cache')
    if (!raw) return null
    const cached = JSON.parse(raw) as { user?: { id?: unknown } }
    return typeof cached?.user?.id === 'string' ? cached.user.id : null
  } catch {
    return null
  }
}

/** Reopen this device's last history database after removing account login. */
export function createLocalConversationStorage(previousDesktopId?: string | null): IndexedDbConversationStorage {
  const userId = previousDesktopId === undefined ? previousWebHistoryUserId() : previousDesktopId
  return new IndexedDbConversationStorage(userId ? accountConversationDatabaseName(userId) : undefined)
}
