import { randomUUID } from 'node:crypto'

export const localApiToken = randomUUID()

export function isLoopbackHost(host: string | undefined): boolean {
  return /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host ?? '')
}

export function isLoopbackOrigin(origin: string): boolean {
  return /^https?:\/\//i.test(origin) && isLoopbackHost(origin.replace(/^https?:\/\//i, ''))
}
