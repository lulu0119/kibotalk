import { grantFinalAiAllowance } from './ai-allowance'
import type { RequestAuth } from './auth'
import { databaseConfigured } from './db'
import { deductCompletedTurn, quotaSummary } from './quota'

export type SttDeduction = {
  billedSeconds: number
  deductedSeconds: number
  overdrawSeconds: number
  exhausted: boolean
  remainingSeconds: number
}

export async function billCompletedSttTurn(args: {
  auth: RequestAuth
  conversationSessionId: string
  requestId: string
  audioSeconds: number
}): Promise<SttDeduction> {
  if (!databaseConfigured()) {
    const billedSeconds = Math.max(1, Math.ceil(args.audioSeconds))
    return {
      billedSeconds,
      deductedSeconds: billedSeconds,
      overdrawSeconds: 0,
      exhausted: false,
      remainingSeconds: Number.POSITIVE_INFINITY,
    }
  }
  const deduction = await deductCompletedTurn({
    userId: args.auth.userId,
    audioSeconds: args.audioSeconds,
    requestId: args.requestId,
    conversationSessionId: args.conversationSessionId,
  })
  if (deduction.exhausted) {
    await grantFinalAiAllowance(args.auth.userId, args.conversationSessionId)
  }
  return {
    ...deduction,
    remainingSeconds: (await quotaSummary(args.auth.userId)).totalSeconds,
  }
}

export async function remainingQuotaSeconds(userId: string): Promise<number> {
  if (!databaseConfigured()) return Number.POSITIVE_INFINITY
  return (await quotaSummary(userId)).totalSeconds
}
