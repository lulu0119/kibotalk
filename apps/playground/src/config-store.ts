import type { SessionLanguageSnapshot } from '@kibotalk/app-shared'
import { create } from 'zustand'
import type { AppLanguage, LearnerLevel } from '@kibotalk/conversation'
import {
  defaultAppConfig,
  defaultProductPrefs,
  isLearnerLevel,
  systemUiLanguage,
  APP_LANGUAGE_OPTIONS,
  LEARNER_LEVEL_OPTIONS,
} from '@kibotalk/app-shared'

export { APP_LANGUAGE_OPTIONS, LEARNER_LEVEL_OPTIONS }

/** Product preview surface: window app vs simulated floating Island+stickies. */
export type ProductSurfaceMode = 'window' | 'floating'

const LANGUAGE_PREFS_KEY = 'kibotalk.playground.languagePrefs'

export type LanguagePrefs = {
  conversationLang: AppLanguage
  uiLang: AppLanguage
  level: LearnerLevel
}

const defaultLanguagePrefs: LanguagePrefs = {
  conversationLang: defaultProductPrefs.conversationLang,
  uiLang: systemUiLanguage(),
  level: defaultProductPrefs.level,
}

function loadLanguagePrefs(): LanguagePrefs {
  if (typeof localStorage === 'undefined') {
    return { ...defaultLanguagePrefs }
  }
  try {
    const raw = localStorage.getItem(LANGUAGE_PREFS_KEY)
    if (!raw) return { ...defaultLanguagePrefs }
    const parsed = JSON.parse(raw) as Partial<LanguagePrefs>
    if (!isLearnerLevel(parsed.level)) return { ...defaultLanguagePrefs }
    return {
      conversationLang: parsed.conversationLang ?? defaultLanguagePrefs.conversationLang,
      uiLang: parsed.uiLang ?? defaultLanguagePrefs.uiLang,
      level: parsed.level,
    }
  } catch {
    return { ...defaultLanguagePrefs }
  }
}

function persistLanguagePrefs(prefs: LanguagePrefs): void {
  try {
    localStorage.setItem(LANGUAGE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Shared playground config — the React analog of a Pinia store. Consumed via
 * `useConfig(s => s.field)` so each component only re-renders on its own field.
 *
 * One store, two consumers (VAD panel + live session): change a knob on one
 * tab and it is already aligned on the other. Fields are grouped by pipeline
 * stage: VAD cut → merge/scheduling → selectors → speaker → language.
 * Language prefs are the only fields persisted to localStorage.
 */
type ConfigState = {
  // VAD cut stage
  speechThreshold: number
  minSilenceDurationMs: number
  minSpeechDurationMs: number
  // Merge / scheduling (segment aggregator flush triggers)
  pauseMs: number
  mergeMaxMs: number
  // Speaker verification (live session only, but shared for consistency)
  speakerThreshold: number
  /** Max candidate rounds visible in Live sticky stack (playground debug). */
  candidateRoundsMax: number
  /** Island: speech-to-text on/off (live session honors this). */
  islandSttEnabled: boolean
  /** Island: reply-suggestion LLM on/off. */
  islandReplyEnabled: boolean
  /**
   * Playground product surface: `window` = in-app cards (no stickies);
   * `floating` = simulated Island + sticky notes.
   */
  productSurfaceMode: ProductSurfaceMode
  // Language prefs (persisted)
  conversationLang: AppLanguage
  uiLang: AppLanguage
  level: LearnerLevel
  /** True while a live session is running — language prefs UI locks (F1). */
  liveSessionRunning: boolean
  // Actions
  patch: (partial: Partial<ConfigState>) => void
  setConversationLang: (lang: AppLanguage) => void
  setUiLang: (lang: AppLanguage) => void
  setCurrentLevel: (level: LearnerLevel) => void
  setLiveSessionRunning: (running: boolean) => void
  reset: () => void
}

const audioDefaults = {
  ...defaultAppConfig.vad,
  pauseMs: defaultAppConfig.aggregator.pauseMs,
  mergeMaxMs: defaultAppConfig.aggregator.maxMs,
  speakerThreshold: defaultAppConfig.speakerThreshold,
  candidateRoundsMax: 2,
  islandSttEnabled: true,
  islandReplyEnabled: true,
  productSurfaceMode: 'window' as ProductSurfaceMode,
  liveSessionRunning: false,
}

function languageSlice(prefs: LanguagePrefs) {
  return {
    conversationLang: prefs.conversationLang,
    uiLang: prefs.uiLang,
    level: prefs.level,
  }
}

function persistFromState(s: ConfigState): void {
  persistLanguagePrefs({
    conversationLang: s.conversationLang,
    uiLang: s.uiLang,
    level: s.level,
  })
}

const initialLang = loadLanguagePrefs()

export const useConfig = create<ConfigState>((set, get) => ({
  ...audioDefaults,
  ...languageSlice(initialLang),
  patch: (partial) => {
    set(partial)
    if (
      partial.conversationLang !== undefined
      || partial.uiLang !== undefined
      || partial.level !== undefined
    ) {
      persistFromState(get())
    }
  },
  setConversationLang: (lang) => {
    set({ conversationLang: lang })
    persistFromState(get())
  },
  setUiLang: (lang) => {
    set({ uiLang: lang })
    persistFromState(get())
  },
  setCurrentLevel: (level) => {
    set({ level })
    persistFromState(get())
  },
  setLiveSessionRunning: (running) => {
    set({ liveSessionRunning: running })
  },
  reset: () => {
    const lang = loadLanguagePrefs()
    set({
      ...audioDefaults,
      ...languageSlice(lang),
      liveSessionRunning: false,
    })
  },
}))

/** Session snapshot of language prefs (frozen at session start). */
export function readLanguageSnapshot(): SessionLanguageSnapshot {
  const s = useConfig.getState()
  return {
    conversationLang: s.conversationLang,
    meaningLang: s.uiLang,
    level: s.level,
  }
}
