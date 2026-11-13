import type { ChatMessage, LlmSettingsStore, ReplyModelHost, ReplyStreamMessage } from '@kibotalk/llm'
import type { OnboardingDownloadProgress } from '@kibotalk/pages'

export const APPLE_SPEECH_IPC = 'apple-speech:message'

export function supportsAppleSpeech(): boolean {
  return process.platform === 'darwin' && Number.parseInt(process.getSystemVersion(), 10) >= 26
}

/**
 * IPC channel names + payload/result types shared by main, preload, and
 * renderer.
 */

/** Mirrors Electron's `systemPreferences.getMediaAccessStatus` return type without importing `electron` into renderer-reachable code. */
export type MediaAccessStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
export type ProductWindowView = 'settings' | 'history' | 'voiceprint'
export type IslandContentSide = 'above' | 'below'
export type IslandBarOffset = { x: number; y: number }
export type DesktopSessionLifecycle = 'restoring' | 'stopped' | 'starting' | 'running' | 'paused'
export type DesktopSessionCommand =
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'toggle-ai'
  | 'open-history'
  | 'open-settings'
  | 'prepare-quit'

export type DesktopSessionState = {
  lifecycle: DesktopSessionLifecycle
  replyEnabled: boolean
  uiLang: 'zh' | 'ja' | 'en'
}

export const IPC_CHANNEL = {
  onboardingGetStatus: 'onboarding:get-status',
  onboardingOpen: 'onboarding:open',
  onboardingComplete: 'onboarding:complete',
  onboardingCompletedEvent: 'onboarding:completed',
  onboardingResize: 'onboarding:resize',
  onboardingDownloadProgress: 'onboarding:download-progress',
  onboardingDownloadReady: 'onboarding:download-ready',
  onboardingClose: 'onboarding:close',
  onboardingViewRequestedEvent: 'onboarding:view-requested',
  permissionsCheckMicrophone: 'permissions:check-microphone',
  permissionsRequestMicrophone: 'permissions:request-microphone',
  permissionsCheckScreenRecording: 'permissions:check-screen-recording',
  permissionsRequestScreenRecording: 'permissions:request-screen-recording',
  systemAudioStart: 'system-audio:start',
  systemAudioStop: 'system-audio:stop',
  islandGetContentSide: 'island:get-content-side',
  islandSettleContentSide: 'island:settle-content-side',
  islandMoveSettledEvent: 'island:move-settled',
  islandHide: 'island:hide',
  islandShow: 'island:show',
  islandSetPointerThrough: 'island:set-pointer-through',
  islandGetBounds: 'island:get-bounds',
  islandSetPosition: 'island:set-position',
  sessionUpdateState: 'session:update-state',
  sessionCommandEvent: 'session:command',
  replyModelLoad: 'reply-model:load',
  replyModelSave: 'reply-model:save',
  replyModelTest: 'reply-model:test',
  replyModelStream: 'reply-model:stream',
  appPreviousHistoryUserId: 'app:previous-history-user-id',
  appSetLaunchAtLogin: 'app:set-launch-at-login',
  appRequestQuit: 'app:request-quit',
  appQuitReady: 'app:quit-ready',
} as const

export type OnboardingStatus = { completed: boolean; view: ProductWindowView }

/** Renderer-measured content box — main process applies it via `setContentSize`. */
export type OnboardingContentSize = { width: number; height: number }

export type SystemAudioStartResult = { ok: true } | { ok: false; error: string }

/** The API surface `preload` exposes on `window.kibotalk`. */
export type KiboTalkDesktopApi = {
  onboarding: {
    getStatus: () => Promise<OnboardingStatus>
    open: (view?: ProductWindowView) => Promise<void>
    complete: () => Promise<void>
    resize: (size: OnboardingContentSize) => Promise<void>
    updateDownloadProgress: (progress: OnboardingDownloadProgress) => void
    downloadReady: () => void
    onDownloadProgress: (callback: (progress: OnboardingDownloadProgress) => void) => () => void
    close: () => Promise<void>
    onCompleted: (callback: () => void) => () => void
    onViewRequested: (callback: (view: ProductWindowView) => void) => () => void
  }
  permissions: {
    checkMicrophone: () => Promise<MediaAccessStatus>
    requestMicrophone: () => Promise<boolean>
    checkScreenRecording: () => Promise<MediaAccessStatus>
    requestScreenRecording: () => Promise<void>
  }
  systemAudio: {
    start: () => Promise<SystemAudioStartResult>
    stop: () => Promise<void>
  }
  appleSpeechTransport: {
    supportedSystem: boolean
    send: (message: unknown) => void
    subscribe: (callback: (message: unknown) => void) => () => void
  }
  island: {
    getContentSide: () => Promise<IslandContentSide>
    /** Single source of truth stays in the renderer; main only computes + persists. */
    settleContentSide: (
      current: IslandContentSide,
      barOffset: IslandBarOffset,
    ) => Promise<IslandContentSide>
    hide: () => Promise<void>
    show: () => Promise<void>
    setPointerThrough: (ignored: boolean) => Promise<void>
    getBounds: () => Promise<{ x: number; y: number; width: number; height: number }>
    setPosition: (x: number, y: number) => Promise<void>
    onMoveSettled: (callback: () => void) => () => void
  }
  session: {
    updateState: (state: DesktopSessionState) => Promise<void>
    onCommand: (callback: (command: DesktopSessionCommand) => void) => () => void
  }
  replyModel: LlmSettingsStore & {
    test: ReplyModelHost['test']
    stream: (input: ChatMessage[], onMessage: (message: ReplyStreamMessage) => void) => () => void
  }
  app: {
    previousHistoryUserId: string | null
    setLaunchAtLogin: (enabled: boolean) => Promise<void>
    requestQuit: () => Promise<void>
    quitReady: () => Promise<void>
  }
}

declare global {
  interface Window {
    kibotalk: KiboTalkDesktopApi
  }
}
