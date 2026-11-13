import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow, screen, type WebContents } from 'electron'
import type { OnboardingDownloadProgress } from '@kibotalk/pages'
import {
  IPC_CHANNEL,
  type OnboardingContentSize,
  type ProductWindowView,
} from '../../shared/ipc'
import { loadRendererEntry } from '../location'
import { embeddedWindowConfig, protectPrivilegedWindowNavigation } from './shared'

/** Matches `--background` (light theme) in `packages/ui/src/theme.css` — the window's initial paint before the renderer's own CSS loads. */
const ONBOARDING_BACKGROUND = '#fafafa'

const ONBOARDING_WIDTH = 840
const ONBOARDING_MIN_WIDTH = 400
/** Floor only — real height comes from renderer `onboarding:resize` once content lays out. */
const ONBOARDING_MIN_HEIGHT = 160

const mainDirname = dirname(fileURLToPath(import.meta.url))
const preload = join(mainDirname, '../preload/index.mjs')

let onboardingWindow: BrowserWindow | null = null
let downloadWindow: BrowserWindow | undefined
let downloadProgress: OnboardingDownloadProgress = null
let downloadReady = false
let requestedView: ProductWindowView = 'settings'

export function getRequestedProductView(): ProductWindowView {
  return requestedView
}

/**
 * Reused for Settings after onboarding. The renderer reports the content height.
 */
export async function openOnboardingWindow(view: ProductWindowView = 'settings'): Promise<BrowserWindow> {
  requestedView = view
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.webContents.send(IPC_CHANNEL.onboardingViewRequestedEvent, view)
    onboardingWindow.show()
    onboardingWindow.focus()
    return onboardingWindow
  }

  const window = new BrowserWindow({
    title: 'KiboTalk 设置',
    width: ONBOARDING_WIDTH,
    height: ONBOARDING_MIN_HEIGHT,
    minWidth: ONBOARDING_MIN_WIDTH,
    minHeight: ONBOARDING_MIN_HEIGHT,
    show: false,
    resizable: true,
    ...embeddedWindowConfig(ONBOARDING_BACKGROUND),
    webPreferences: {
      preload,
      sandbox: false,
    },
  })

  window.on('ready-to-show', () => window.show())
  protectPrivilegedWindowNavigation(window)
  window.on('move', positionDownloadWindow)
  window.on('minimize', () => downloadWindow?.hide())
  window.on('restore', syncDownloadWindow)
  window.on('closed', () => {
    onboardingWindow = null
    downloadProgress = null
    downloadWindow?.destroy()
  })

  onboardingWindow = window
  try {
    await loadRendererEntry(window, 'onboarding')
  } catch (cause) {
    if (!window.isDestroyed()) window.destroy()
    throw cause
  }
  window.webContents.send(IPC_CHANNEL.onboardingViewRequestedEvent, requestedView)
  return window
}

function positionDownloadWindow() {
  if (!onboardingWindow || !downloadWindow) return
  const { x, y, width } = screen.getDisplayMatching(onboardingWindow.getBounds()).workArea
  downloadWindow.setPosition(x + width - downloadWindow.getBounds().width - 16, y + 16)
}

function syncDownloadWindow() {
  if (!downloadWindow || !downloadReady) return
  if (!downloadProgress || onboardingWindow?.isMinimized()) {
    downloadWindow.hide()
    return
  }
  positionDownloadWindow()
  downloadWindow.webContents.send(IPC_CHANNEL.onboardingDownloadProgress, downloadProgress)
  if (!downloadWindow.isVisible()) downloadWindow.showInactive()
}

export function markOnboardingDownloadReady(sender: WebContents): void {
  if (sender !== downloadWindow?.webContents) return
  downloadReady = true
  syncDownloadWindow()
}

export function updateOnboardingDownloadProgress(sender: WebContents, progress: OnboardingDownloadProgress): void {
  if (sender !== onboardingWindow?.webContents) return
  downloadProgress = progress
  if (downloadWindow) {
    syncDownloadWindow()
    return
  }
  if (!progress) return

  const window = new BrowserWindow({
    width: 160,
    height: 34,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: { preload, sandbox: false },
  })
  downloadWindow = window
  window.on('closed', () => {
    downloadWindow = undefined
    downloadReady = false
  })
  window.setIgnoreMouseEvents(true)
  protectPrivilegedWindowNavigation(window)
  void loadRendererEntry(window, 'onboarding', 'download-progress').catch(() => {
    if (!window.isDestroyed()) window.destroy()
  })
}

/** Applies renderer-measured content size. */
export function resizeOnboardingWindow(size: OnboardingContentSize): void {
  if (!onboardingWindow || onboardingWindow.isDestroyed()) return
  const width = Math.max(ONBOARDING_MIN_WIDTH, Math.ceil(size.width))
  const height = Math.max(ONBOARDING_MIN_HEIGHT, Math.ceil(size.height))
  onboardingWindow.setContentSize(width, height)
  if (!onboardingWindow.isVisible()) {
    onboardingWindow.show()
    onboardingWindow.focus()
  }
}

export function closeOnboardingWindow(): void {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.close()
  }
}
