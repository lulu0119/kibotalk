import type { ConversationStorage } from '@kibotalk/conversation'
import { defaultProductPrefs, systemUiLanguage } from './config'
import { persistLanguagePrefs, type LanguagePrefs } from './language-prefs'
import { clearSpeakerEmbeddingData } from './speaker-embedding-storage'

export async function wipeLocalPersonalData(
  storage?: ConversationStorage,
): Promise<LanguagePrefs> {
  if (storage) {
    await storage.clearHistory()
    await storage.clearActiveSession()
  }
  await clearSpeakerEmbeddingData()
  const prefs: LanguagePrefs = {
    ...defaultProductPrefs,
    uiLang: systemUiLanguage(),
  }
  persistLanguagePrefs(prefs)
  return prefs
}
