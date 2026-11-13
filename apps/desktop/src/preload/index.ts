import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNEL } from '../shared/ipc'
import type { KiboTalkDesktopApi } from '../shared/ipc'

const api: KiboTalkDesktopApi = {
  onboarding: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNEL.onboardingGetStatus),
    open: (view) => ipcRenderer.invoke(IPC_CHANNEL.onboardingOpen, view),
    complete: () => ipcRenderer.invoke(IPC_CHANNEL.onboardingComplete),
    resize: (size) => ipcRenderer.invoke(IPC_CHANNEL.onboardingResize, size),
    close: () => ipcRenderer.invoke(IPC_CHANNEL.onboardingClose),
    onCompleted: (callback) => {
      const listener = () => callback()
      ipcRenderer.on(IPC_CHANNEL.onboardingCompletedEvent, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNEL.onboardingCompletedEvent, listener)
    },
    onViewRequested: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, view: Parameters<typeof callback>[0]) => callback(view)
      ipcRenderer.on(IPC_CHANNEL.onboardingViewRequestedEvent, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNEL.onboardingViewRequestedEvent, listener)
    },
  },
  permissions: {
    checkMicrophone: () => ipcRenderer.invoke(IPC_CHANNEL.permissionsCheckMicrophone),
    requestMicrophone: () => ipcRenderer.invoke(IPC_CHANNEL.permissionsRequestMicrophone),
    checkScreenRecording: () => ipcRenderer.invoke(IPC_CHANNEL.permissionsCheckScreenRecording),
    requestScreenRecording: () => ipcRenderer.invoke(IPC_CHANNEL.permissionsRequestScreenRecording),
  },
  systemAudio: {
    start: () => ipcRenderer.invoke(IPC_CHANNEL.systemAudioStart),
    stop: () => ipcRenderer.invoke(IPC_CHANNEL.systemAudioStop),
  },
  island: {
    getContentSide: () => ipcRenderer.invoke(IPC_CHANNEL.islandGetContentSide),
    settleContentSide: (current, barOffset) => ipcRenderer.invoke(
      IPC_CHANNEL.islandSettleContentSide,
      current,
      barOffset,
    ),
    hide: () => ipcRenderer.invoke(IPC_CHANNEL.islandHide),
    show: () => ipcRenderer.invoke(IPC_CHANNEL.islandShow),
    setPointerThrough: (ignored) => ipcRenderer.invoke(IPC_CHANNEL.islandSetPointerThrough, ignored),
    getBounds: () => ipcRenderer.invoke(IPC_CHANNEL.islandGetBounds),
    setPosition: (x, y) => ipcRenderer.invoke(IPC_CHANNEL.islandSetPosition, x, y),
    onMoveSettled: (callback) => {
      const listener = () => callback()
      ipcRenderer.on(IPC_CHANNEL.islandMoveSettledEvent, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNEL.islandMoveSettledEvent, listener)
    },
  },
  session: {
    updateState: (state) => ipcRenderer.invoke(IPC_CHANNEL.sessionUpdateState, state),
    onCommand: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, command: Parameters<typeof callback>[0]) => callback(command)
      ipcRenderer.on(IPC_CHANNEL.sessionCommandEvent, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNEL.sessionCommandEvent, listener)
    },
  },
  replyModel: {
    load: () => ipcRenderer.invoke(IPC_CHANNEL.replyModelLoad),
    save: (settings) => ipcRenderer.invoke(IPC_CHANNEL.replyModelSave, settings),
    stream: (input, onMessage) => {
      const { port1, port2 } = new MessageChannel()
      port1.onmessage = ({ data }) => {
        onMessage(data)
        if (data.type !== 'token') port1.close()
      }
      ipcRenderer.postMessage(IPC_CHANNEL.replyModelStream, input, [port2])
      return () => port1.close()
    },
  },
  app: {
    previousHistoryUserId: ipcRenderer.sendSync(IPC_CHANNEL.appPreviousHistoryUserId),
    setLaunchAtLogin: (enabled) => ipcRenderer.invoke(IPC_CHANNEL.appSetLaunchAtLogin, enabled),
    requestQuit: () => ipcRenderer.invoke(IPC_CHANNEL.appRequestQuit),
    quitReady: () => ipcRenderer.invoke(IPC_CHANNEL.appQuitReady),
  },
}

contextBridge.exposeInMainWorld('kibotalk', api)
