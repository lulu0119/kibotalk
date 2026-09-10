type SessionLease = {
  llmInFlight: boolean
  activeWebsockets: number
}

const leases = new Map<string, SessionLease>()
const MAX_WEBSOCKETS_PER_SESSION = 2

export type SessionIdentity = {
  userId: string
  deviceSessionId: string
  conversationSessionId: string
}

function sessionKey(identity: SessionIdentity): string {
  return `${identity.userId}:${identity.deviceSessionId}:${identity.conversationSessionId}`
}

function leaseFor(identity: SessionIdentity): SessionLease {
  const key = sessionKey(identity)
  const current = leases.get(key)
  if (current) return current
  const created: SessionLease = {
    llmInFlight: false,
    activeWebsockets: 0,
  }
  leases.set(key, created)
  return created
}

export function acquireLlmSlot(identity: SessionIdentity): boolean {
  const lease = leaseFor(identity)
  if (lease.llmInFlight) return false
  lease.llmInFlight = true
  return true
}

export function releaseLlmSlot(identity: SessionIdentity): void {
  leaseFor(identity).llmInFlight = false
}

export function acquireWebsocket(identity: SessionIdentity): boolean {
  const lease = leaseFor(identity)
  if (lease.activeWebsockets >= MAX_WEBSOCKETS_PER_SESSION) return false
  lease.activeWebsockets += 1
  return true
}

export function releaseWebsocket(identity: SessionIdentity): void {
  const lease = leaseFor(identity)
  lease.activeWebsockets = Math.max(0, lease.activeWebsockets - 1)
}

export function resetAiSessionStateForTests(): void {
  leases.clear()
}
