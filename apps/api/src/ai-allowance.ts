import { databaseConfigured, getDatabase } from './db'
import { quotaSummary } from './quota'

export type AiUseAuthorization = {
  allowed: boolean
  allowanceConsumed: boolean
}

export async function grantFinalAiAllowance(
  userId: string,
  conversationSessionId: string,
): Promise<void> {
  const sql = getDatabase()
  await sql`
    INSERT INTO final_ai_allowances (
      user_id,
      conversation_session_id,
      reply_remaining,
      expires_at
    )
    VALUES (
      ${userId},
      ${conversationSessionId},
      1,
      now() + interval '24 hours'
    )
    ON CONFLICT (user_id, conversation_session_id) DO UPDATE SET
      reply_remaining = 1,
      expires_at = EXCLUDED.expires_at
    WHERE final_ai_allowances.expires_at <= now()
  `
}

export async function authorizeAiUse(
  userId: string,
  conversationSessionId: string,
): Promise<AiUseAuthorization> {
  if (!databaseConfigured() || process.env.APP_ENV !== 'production') {
    return { allowed: true, allowanceConsumed: false }
  }
  if ((await quotaSummary(userId)).totalSeconds > 0) {
    return { allowed: true, allowanceConsumed: false }
  }
  const sql = getDatabase()
  const rows = await sql`
    UPDATE final_ai_allowances
    SET reply_remaining = reply_remaining - 1
    WHERE user_id = ${userId}
      AND conversation_session_id = ${conversationSessionId}
      AND expires_at > now()
      AND reply_remaining > 0
    RETURNING user_id
  `
  return { allowed: rows.length > 0, allowanceConsumed: rows.length > 0 }
}

export async function refundAiAllowance(
  userId: string,
  conversationSessionId: string,
): Promise<void> {
  if (!databaseConfigured()) return
  const sql = getDatabase()
  await sql`
    UPDATE final_ai_allowances
    SET reply_remaining = LEAST(1, reply_remaining + 1)
    WHERE user_id = ${userId}
      AND conversation_session_id = ${conversationSessionId}
      AND expires_at > now()
  `
}
