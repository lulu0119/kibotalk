import type { Speaker } from '@kibotalk/conversation'

const speakerMargin = 0.05

export function classifySpeaker(similarity: number, threshold: number): Speaker | null {
  if (similarity >= threshold + speakerMargin) return 'user'
  if (similarity <= threshold - speakerMargin) return 'other'
  return null
}

/**
 * Keeps an ambiguous score on the current speaker. A speaker change requires
 * crossing the threshold by the configured margin, so one noisy fragment does
 * not immediately split the formal turn.
 */
export function stabilizeSpeaker(
  similarity: number,
  current: Speaker,
  threshold: number,
  margin = speakerMargin,
): Speaker {
  if (current === 'other') {
    return similarity >= threshold + margin ? 'user' : 'other'
  }
  return similarity <= threshold - margin ? 'other' : 'user'
}
