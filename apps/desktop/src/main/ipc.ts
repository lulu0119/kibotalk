import { app, BrowserWindow, ipcMain } from 'electron'
import {
  IPC_CHANNEL,
  type DesktopSessionState,
  type IslandBarOffset,
  type IslandContentSide,
  type OnboardingContentSize,
  type ProductWindowView,
} from '../shared/ipc'
import { readConfig, updateConfig } from './config'
import { registerReplyModelHandlers } from './reply-model'
import {
  checkMicrophonePermission,
  checkScreenRecordingPermission,
  requestMicrophonePermission,
  requestScreenRecordingPermission,
} from './permissions'
import { startSystemAudioCapture, stopSystemAudioCapture } from './system-audio'
import { previousHistoryUserId } from './legacy-history'
import {
  closeOnboardingWindow,
  getRequestedProductView,
  markOnboardingDownloadReady,
  openOnboardingWindow,
  resizeOnboardingWindow,
  updateOnboardingDownloadProgress,
} from './windows/onboarding'
import { settleIslandContentSide } from './windows/island'

function isIslandBarOffset(value: unknown): value is IslandBarOffset {
  if (!value || typeof value !== 'object') return false
  const offset = value as Partial<IslandBarOffset>
  return Number.isFinite(offset.x) && Number.isFinite(offset.y)
}

/** Registers every `ipcMain.handle` channel the preload bridge exposes as `window.kibotalk`. */
export function registerIpcHandlers(params: {
  getIslandWindow: () => BrowserWindow | null
  onSessionState: (state: DesktopSessionState) => void
  requestQuit: () => Promise<void>
  quitReady: () => void
}): void {
  ipcMain.handle(IPC_CHANNEL.onboardingGetStatus, () => ({
    completed: readConfig().onboardingCompleted,
    view: getRequestedProductView(),
  }))

  ipcMain.handle(IPC_CHANNEL.onboardingOpen, async (_event, view?: ProductWindowView) => {
    await openOnboardingWindow(view)
  })

  ipcMain.handle(IPC_CHANNEL.onboardingComplete, () => {
    updateConfig({ onboardingCompleted: true })
    if (process.platform === 'darwin') app.dock?.hide()
    params.getIslandWindow()?.webContents.send(IPC_CHANNEL.onboardingCompletedEvent)
    closeOnboardingWindow()
  })

  ipcMain.handle(IPC_CHANNEL.onboardingResize, (_event, size: OnboardingContentSize) => {
    resizeOnboardingWindow(size)
  })
  ipcMain.on(IPC_CHANNEL.onboardingDownloadProgress, (event, progress) => {
    updateOnboardingDownloadProgress(event.sender, progress)
  })
  ipcMain.on(IPC_CHANNEL.onboardingDownloadReady, (event) => {
    markOnboardingDownloadReady(event.sender)
  })

  ipcMain.handle(IPC_CHANNEL.onboardingClose, () => {
    closeOnboardingWindow()
  })

  ipcMain.handle(IPC_CHANNEL.permissionsCheckMicrophone, () => checkMicrophonePermission())
  ipcMain.handle(IPC_CHANNEL.permissionsRequestMicrophone, () => requestMicrophonePermission())
  ipcMain.handle(IPC_CHANNEL.permissionsCheckScreenRecording, () => checkScreenRecordingPermission())
  ipcMain.handle(IPC_CHANNEL.permissionsRequestScreenRecording, () => requestScreenRecordingPermission())

  ipcMain.handle(IPC_CHANNEL.systemAudioStart, () => startSystemAudioCapture())
  ipcMain.handle(IPC_CHANNEL.systemAudioStop, () => stopSystemAudioCapture())

  ipcMain.handle(IPC_CHANNEL.islandGetContentSide, () => readConfig().islandContentSide)
  ipcMain.handle(
    IPC_CHANNEL.islandSettleContentSide,
    (_event, current: IslandContentSide, barOffset: unknown) => {
      const window = params.getIslandWindow()
      if (
        !window
        || (current !== 'above' && current !== 'below')
        || !isIslandBarOffset(barOffset)
      ) {
        return readConfig().islandContentSide
      }
      return settleIslandContentSide(window, current, barOffset)
    },
  )
  ipcMain.handle(IPC_CHANNEL.islandHide, () => params.getIslandWindow()?.hide())
  ipcMain.handle(IPC_CHANNEL.islandShow, () => {
    params.getIslandWindow()?.show()
    params.getIslandWindow()?.focus()
  })
  ipcMain.handle(IPC_CHANNEL.islandSetPointerThrough, (_event, ignored: boolean) => {
    params.getIslandWindow()?.setIgnoreMouseEvents(ignored, { forward: true })
  })
  ipcMain.handle(IPC_CHANNEL.islandGetBounds, () => {
    const window = params.getIslandWindow()
    if (!window) return { x: 0, y: 0, width: 0, height: 0 }
    return window.getBounds()
  })
  ipcMain.handle(IPC_CHANNEL.islandSetPosition, (_event, x: number, y: number) => {
    const window = params.getIslandWindow() as
      | (BrowserWindow & { __scheduleMoveSettled?: () => void })
      | null
    if (!window || !Number.isFinite(x) || !Number.isFinite(y)) return
    window.setPosition(Math.round(x), Math.round(y))
    window.__scheduleMoveSettled?.()
  })

  ipcMain.handle(IPC_CHANNEL.sessionUpdateState, (_event, state: DesktopSessionState) => {
    params.onSessionState(state)
  })

  ipcMain.handle(IPC_CHANNEL.appSetLaunchAtLogin, (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
  })
  ipcMain.handle(IPC_CHANNEL.appRequestQuit, () => params.requestQuit())
  ipcMain.handle(IPC_CHANNEL.appQuitReady, () => params.quitReady())
  ipcMain.on(IPC_CHANNEL.appPreviousHistoryUserId, (event) => {
    event.returnValue = previousHistoryUserId()
  })
  registerReplyModelHandlers()
}
