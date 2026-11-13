import { shell, systemPreferences } from 'electron'
import type { MediaAccessStatus } from '../shared/ipc'

const isMacOS = process.platform === 'darwin'

/**
 * macOS can prompt for microphone access from the voiceprint recorder.
 * System audio capture requires Screen Recording access, which users grant in Settings.
 */

export function checkMicrophonePermission(): MediaAccessStatus {
  if (!isMacOS) return 'granted'
  return systemPreferences.getMediaAccessStatus('microphone')
}

export async function requestMicrophonePermission(): Promise<boolean> {
  if (!isMacOS) return true
  return systemPreferences.askForMediaAccess('microphone')
}

export function checkScreenRecordingPermission(): MediaAccessStatus {
  if (!isMacOS) return 'granted'
  return systemPreferences.getMediaAccessStatus('screen')
}

/** No programmatic prompt exists for Screen Recording on macOS — deep-link into System Settings instead. */
export async function requestScreenRecordingPermission(): Promise<void> {
  if (!isMacOS) return
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
}
